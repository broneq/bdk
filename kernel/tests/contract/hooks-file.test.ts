// `plugin-tooling`, Settings check at session start, scenario "hooks file",
// and `kernel-cli/hooks`, Guard hooks file and prefilter: the plugin registers
// the SessionStart command, the two guards and the session-end hook, no Stop
// hook, and no hook command anywhere runs Python. The guard scripts fail
// closed without the kernel and start Node only for a payload a guard denies.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import upeTyped from "../../../tests/fixtures/host-payloads/2.1.281/upe-typed.json" with { type: "json" };
import { deniedPayloads, mainBash, subagentBash } from "../../src/hooks/tests/payloads.ts";
import { REPO_ROOT } from "../support/run.ts";

const SESSION_START =
  'node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."';
const SESSION_END = SESSION_START.replace("session-start", "session-end");
/** A guard's hooks.json command: the script sourced into the host's shell, failing closed when missing. */
const sourced = (script: string, what: string): string =>
  `f="\${CLAUDE_PLUGIN_ROOT}/hooks/guard/${script}"; [ -r "$f" ] || { echo "guard/kernel-unavailable: $f is missing, so BDK cannot check ${what}; reinstall the BDK plugin" >&2; exit 2; }; . "$f"`;
const PRE_TOOL = sourced("pre-tool.sh", "this tool call");
const PROMPT_EXPANSION = sourced("prompt-expansion.sh", "the stage gate");

interface HookGroup {
  matcher?: string;
  hooks: { type: string; command: string }[];
}

const hooksFile = JSON.parse(readFileSync(join(REPO_ROOT, "hooks/hooks.json"), "utf8")) as {
  hooks: Record<string, HookGroup[]>;
};

const commands = (groups: HookGroup[]) =>
  groups.flatMap((group) => group.hooks.map((hook) => hook.command));

describe("hooks/hooks.json", () => {
  it("has exactly one SessionStart command, the kernel session-start hook", () => {
    expect(commands(hooksFile.hooks.SessionStart ?? [])).toEqual([SESSION_START]);
  });

  it("holds exactly the SessionStart entry and the three T24 entries", () => {
    expect(hooksFile.hooks).toStrictEqual({
      SessionStart: [{ hooks: [{ type: "command", command: SESSION_START }] }],
      PreToolUse: [
        {
          matcher: "^(Bash|Edit|Write|NotebookEdit|Agent)$",
          hooks: [{ type: "command", command: PRE_TOOL }],
        },
      ],
      UserPromptExpansion: [
        {
          matcher: "^bdk:(plan|execute|close|run)$",
          hooks: [{ type: "command", command: PROMPT_EXPANSION }],
        },
      ],
      SessionEnd: [{ hooks: [{ type: "command", command: SESSION_END }] }],
    });
  });

  it("has no Stop entry", () => {
    expect(Object.keys(hooksFile.hooks)).not.toContain("Stop");
  });

  // Scenario "kernel unavailable at session start": the host runs the command
  // through a shell, so an empty PATH stands in for a machine without node.
  it("prints the kernel-unavailable STOP line and exits 0 without node", () => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-no-node-"));
    try {
      const result = spawnSync("/bin/sh", ["-c", SESSION_START], {
        cwd: empty,
        encoding: "utf8",
        env: { CLAUDE_PLUGIN_ROOT: REPO_ROOT, PATH: empty },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(
        /BDK STOP: kernel unavailable \(exit 127\)\. Install Node >= 22\.13 and run \/bdk:setup\.\n$/,
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("runs no python3 command", () => {
    const all = Object.values(hooksFile.hooks).flatMap(commands);
    expect(all.filter((command) => command.includes("python3"))).toEqual([]);
  });
});

/** The kernel line of a guard script: its last non-comment line. */
function kernelLine(script: string): string {
  const lines = readFileSync(join(REPO_ROOT, "hooks/guard", script), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  return lines.at(-1) ?? "";
}

/** The `guard-wrapper` regex of `kernel-cli`, Output modes. */
function guardWrapper(): RegExp {
  const spec = readFileSync(join(REPO_ROOT, "openspec/specs/kernel-cli/spec.md"), "utf8");
  const block = /```regex guard-wrapper\n([^\n]+)\n```/.exec(spec)?.[1];
  if (block === undefined) throw new Error("kernel-cli has no guard-wrapper regex");
  return new RegExp(block);
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs a guard script as the host does (`sh -c` of the hooks.json command),
 * with `pluginRoot` as CLAUDE_PLUGIN_ROOT and `path` as PATH.
 */
function guard(command: string, payload: string, pluginRoot: string, path: string): Run {
  const result = spawnSync(
    "/bin/sh",
    ["-c", command.replace("${CLAUDE_PLUGIN_ROOT}/hooks", `${REPO_ROOT}/hooks`)],
    {
      input: payload,
      encoding: "utf8",
      env: { CLAUDE_PLUGIN_ROOT: pluginRoot, PATH: path },
    },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A PATH directory holding `sh` and `cat` but no node: a machine without Node. */
function withoutNode(dir: string): string {
  for (const tool of ["sh", "cat"]) {
    const found = spawnSync("/bin/sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
    symlinkSync(found.stdout.trim(), join(dir, tool));
  }
  return dir;
}

describe("guard scripts", () => {
  it.each(["pre-tool.sh", "prompt-expansion.sh"])(
    "%s ends with a guard-wrapper kernel line",
    (script) => {
      expect(kernelLine(script)).toMatch(guardWrapper());
    },
  );

  it("pre-tool.sh passes main-thread git status without starting node", () => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-no-node-"));
    try {
      const run = guard(
        PRE_TOOL,
        JSON.stringify(mainBash("git status")),
        empty,
        withoutNode(empty),
      );
      expect(run).toStrictEqual({ status: 0, stdout: "", stderr: "" });
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it.each([
    ["a subagent git commit", subagentBash("git commit -m x")],
    ["main-thread bdk.mjs hooks", mainBash('node "$P/dist/bdk.mjs" hooks pre-tool')],
  ])("pre-tool.sh blocks %s with guard/kernel-unavailable without the bundle", (_, payload) => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-no-bundle-"));
    try {
      const run = guard(PRE_TOOL, JSON.stringify(payload), empty, process.env.PATH ?? "");
      expect(run.status).toBe(2);
      expect(run.stderr).toMatch(/^guard\/kernel-unavailable: /);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it.each([
    ["without the bundle", false],
    ["without node", true],
  ])("prompt-expansion.sh blocks a stage command %s", (_, noNode) => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-no-kernel-"));
    try {
      const payload = JSON.stringify({ ...upeTyped.payloads[0], command_name: "bdk:plan" });
      const path = noNode ? withoutNode(empty) : (process.env.PATH ?? "");
      const run = guard(PROMPT_EXPANSION, payload, noNode ? REPO_ROOT : empty, path);
      expect(run.status).toBe(2);
      expect(run.stderr).toMatch(/^guard\/kernel-unavailable: /);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it.each([
    ["pre-tool.sh", () => PRE_TOOL],
    ["prompt-expansion.sh", () => PROMPT_EXPANSION],
  ])("blocks with guard/kernel-unavailable when %s is missing", (_, command) => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-no-script-"));
    try {
      const result = spawnSync("/bin/sh", ["-c", command()], {
        input: JSON.stringify(mainBash("git status")),
        encoding: "utf8",
        env: { CLAUDE_PLUGIN_ROOT: empty, PATH: process.env.PATH ?? "" },
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/^guard\/kernel-unavailable: .* is missing/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  // No false negative: every payload the kernel denies reaches the kernel,
  // which is missing here, so the script blocks instead of passing.
  it("pre-tool.sh hands every denied payload of the unit corpus to the kernel", () => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-prefilter-"));
    try {
      const dropped = deniedPayloads()
        .filter(
          ([, payload]) =>
            guard(PRE_TOOL, JSON.stringify(payload), empty, process.env.PATH ?? "").status !== 2,
        )
        .map(([label]) => label);
      expect(dropped).toStrictEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("skill frontmatter hooks", () => {
  it("run no python3 command", () => {
    const offenders = readdirSync(join(REPO_ROOT, "skills"))
      .map((skill) => join(REPO_ROOT, "skills", skill, "SKILL.md"))
      .filter((path) => existsSync(path))
      .filter((path) => {
        const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(path, "utf8"))?.[1] ?? "";
        return frontmatter.split("\n").some((line) => /^\s*command:.*python3/.test(line));
      });
    expect(offenders).toEqual([]);
  });
});
