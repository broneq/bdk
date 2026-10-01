// The T24 acceptance signal through the committed bundle and the guard
// scripts, run as the host runs them (`sh -c` of the hooks.json command) on a
// real repository, driven by the recorded T01 payloads.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import upeTyped from "../../../../tests/fixtures/host-payloads/2.1.281/upe-typed.json" with { type: "json" };
import { opened, writeDesign, done, verdict, write } from "../../graph/tests/e2e-support.ts";
import { bdk, git } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { agentFg, mainBash, recorded, subagentBash, preEdit } from "./payloads.ts";
import type { Payload } from "./payloads.ts";

interface HookFile {
  hooks: Record<string, { hooks: { command: string }[] }[]>;
}

const HOOKS = (JSON.parse(readFileSync(join(REPO_ROOT, "hooks/hooks.json"), "utf8")) as HookFile)
  .hooks;
const command = (event: string): string => HOOKS[event]?.[0]?.hooks[0]?.command ?? "";

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

interface HookRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface HookOptions {
  /** The plugin root; the repository by default, a copy without the bundle for "kernel removed". */
  readonly pluginRoot?: string;
  /** PATH; the harness's by default. */
  readonly path?: string;
}

/** The hooks.json command of `event` through `sh -c` in `cwd`, `payload` on stdin. */
function hook(event: string, cwd: string, payload: Payload, options: HookOptions = {}): HookRun {
  const result = spawnSync("/bin/sh", ["-c", command(event)], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify({ ...payload, cwd }),
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "BDK Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "BDK Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
      HOME: cwd,
      XDG_CONFIG_HOME: join(cwd, ".xdg"),
      CLAUDE_PLUGIN_ROOT: options.pluginRoot ?? REPO_ROOT,
      PATH: options.path ?? process.env.PATH ?? "",
    },
  });
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** A plugin root holding the guard scripts but no `dist/bdk.mjs`. */
function withoutBundle(): string {
  const root = tempDir("bdk-plugin-");
  mkdirSync(join(root, "hooks/guard"), { recursive: true });
  for (const script of ["pre-tool.sh", "prompt-expansion.sh"]) {
    const text = readFileSync(join(REPO_ROOT, "hooks/guard", script), "utf8");
    writeFileSync(join(root, "hooks/guard", script), text);
  }
  return root;
}

/** A PATH with `sh` and `cat` only: node is not found. */
function withoutNode(): string {
  const dir = tempDir("bdk-bin-");
  for (const tool of ["sh", "cat"]) {
    const found = spawnSync("/bin/sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
    symlinkSync(found.stdout.trim(), join(dir, tool));
  }
  return dir;
}

function typed(name: string, fields: Payload = {}): Payload {
  return {
    ...(upeTyped.payloads[0] as Payload),
    session_id: "sess-e2e",
    command_name: name,
    command_args: "",
    prompt: `/${name}`,
    ...fields,
  };
}

function transitions(dir: string): Record<string, unknown>[] {
  return readdirSync(join(dir, "log"))
    .filter((name) => name.includes("-transition-"))
    .map((name) => readFileSync(join(dir, "log", name), "utf8"))
    .filter((text) => !text.includes("input-hash:"))
    .map((text) => ({ text }));
}

function designDone(): { root: string; dir: string } {
  const change = opened();
  writeDesign(change.dir, "design");
  writeDesign(change.dir, "architecture");
  done(change.root, "design");
  done(change.root, "architecture");
  verdict(change.dir, [], "design-verify");
  done(change.root, "design-verify");
  return change;
}

describe("UserPromptExpansion guard", () => {
  it("a typed /bdk:plan writes a source: user entry and the gate is done", () => {
    const { root, dir } = designDone();
    const run = hook("UserPromptExpansion", root, typed("bdk:plan"));
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^\[BDK\] gate:design passed by the user in L-[0-9a-z]{8}/);
    const written = transitions(dir);
    expect(written).toHaveLength(1);
    expect(written[0]?.text).toContain("source: user");
    expect(written[0]?.text).toContain("session: sess-e2e");
    const next = bdk(["next", "--json"], root).json as { gates: unknown[] };
    expect(next.gates[0]).toMatchObject({ gate: "gate:design", done: true, passedBy: "user" });
  });

  it("a payload without the user marker writes no entry", () => {
    const { root, dir } = designDone();
    const run = hook("UserPromptExpansion", root, typed("bdk:plan", { expansion_type: "skill" }));
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(/^input\/invalid-argument: the UserPromptExpansion payload has no /);
    expect(transitions(dir)).toStrictEqual([]);
  });

  it("/bdk:plan before the design is ready is blocked with the reason and writes nothing", () => {
    const { root, dir } = opened();
    const run = hook("UserPromptExpansion", root, typed("bdk:plan"));
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(
      /^policy\/gate-not-ready: gate:design is not ready for \/bdk:plan: /,
    );
    expect(transitions(dir)).toStrictEqual([]);
  });

  describe("blocks a stage command on unreadable Change state with exit 2, not 4", () => {
    it("state/corrupted-index", () => {
      const { root } = designDone();
      const index = join(root, ".bdk/.machine/index.sqlite");
      rmSync(index, { force: true });
      mkdirSync(index, { recursive: true });
      const run = hook("UserPromptExpansion", root, typed("bdk:plan"));
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/^state\/corrupted-index: /);
    });

    it("state/ledger-invalid", () => {
      const { root, dir } = designDone();
      write(dir, "log/20260101T000000Z-finding-L-broken00.md", "---\nschema: 1\n---\n");
      const run = hook("UserPromptExpansion", root, typed("bdk:plan"));
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/^state\/ledger-invalid: /);
    });

    it("state/change-dir-missing", () => {
      const { root, dir } = opened();
      rmSync(dir, { recursive: true });
      const run = hook("UserPromptExpansion", root, typed("bdk:plan"));
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/^state\/change-dir-missing: /);
    });
  });

  it("blocks a stage command with guard/kernel-unavailable when the kernel is removed", () => {
    const { root } = designDone();
    const run = hook("UserPromptExpansion", root, typed("bdk:plan"), {
      pluginRoot: withoutBundle(),
    });
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(/^guard\/kernel-unavailable: /);
  });
});

describe("PreToolUse guard", () => {
  it("denies a subagent git stash while the main thread passes", () => {
    const { root } = opened();
    const subagent = hook("PreToolUse", root, subagentBash("git stash"));
    expect(subagent.code).toBe(2);
    expect(subagent.stderr).toMatch(/^guard\/subagent-git: subagents may not run git stash;/);
    expect(JSON.parse(subagent.stdout)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: expect.stringMatching(/^guard\/subagent-git: /) as string,
      },
    });
    expect(hook("PreToolUse", root, mainBash("git stash"))).toStrictEqual({
      code: 0,
      stdout: "",
      stderr: "",
    });
  });

  it("denies a subagent bdk.mjs commit", () => {
    const { root } = opened();
    const run = hook(
      "PreToolUse",
      root,
      subagentBash('node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" commit 02-3'),
    );
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(
      /^guard\/subagent-kernel-command: subagents may not run bdk commit,/,
    );
  });

  it("denies a subagent commit through a bdk shell function", () => {
    const { root } = opened();
    const run = hook(
      "PreToolUse",
      root,
      subagentBash('bdk() { node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" "$@"; }; bdk commit 02-3'),
    );
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(
      /^guard\/subagent-kernel-command: subagents may not run bdk commit,/,
    );
  });

  it("denies an Edit under .bdk/specs/", () => {
    const { root } = opened();
    const run = hook(
      "PreToolUse",
      root,
      recorded(preEdit, { file_path: join(root, ".bdk/specs/auth/spec.md") }),
    );
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(/^guard\/spec-dir-write: /);
  });

  it("passes a recorded Agent call to a non-BDK agent", () => {
    const { root } = opened();
    expect(hook("PreToolUse", root, recorded(agentFg)).code).toBe(0);
  });

  it("decides outside a git work tree instead of blocking", () => {
    const outside = tempDir("bdk-outside-");
    expect(hook("PreToolUse", outside, subagentBash("git init")).code).toBe(0);
    expect(hook("PreToolUse", outside, subagentBash("git stash")).code).toBe(2);
  });

  describe("kernel removed", () => {
    it("blocks a subagent git commit", () => {
      const { root } = opened();
      const run = hook("PreToolUse", root, subagentBash("git commit -m x"), {
        pluginRoot: withoutBundle(),
      });
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/^guard\/kernel-unavailable: /);
    });

    it("blocks a main-thread bdk.mjs hooks", () => {
      const { root } = opened();
      const run = hook(
        "PreToolUse",
        root,
        mainBash('node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks prompt-expansion'),
        { pluginRoot: withoutBundle() },
      );
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/^guard\/kernel-unavailable: /);
    });

    it("passes a main-thread git status without starting node", () => {
      const { root } = opened();
      const run = hook("PreToolUse", root, mainBash("git status"), {
        pluginRoot: withoutBundle(),
        path: withoutNode(),
      });
      expect(run).toStrictEqual({ code: 0, stdout: "", stderr: "" });
    });
  });
});

describe("SessionEnd hook", () => {
  it("commits a checkpoint of the Change directory", () => {
    const { root } = opened();
    const run = hook("SessionEnd", root, { hook_event_name: "SessionEnd", reason: "clear" });
    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(/^\[BDK\] checkpoint [0-9a-f]{7} of \S+\n$/);
    expect(git(root, "log", "-1", "--format=%s")).toMatch(/^chore\(bdk\): checkpoint /);
  });

  it("reports a rebase in progress as skipped, with no commit and no STOP line", () => {
    const { root } = opened();
    mkdirSync(join(root, ".git/rebase-merge"), { recursive: true });
    const before = git(root, "rev-parse", "HEAD");
    const result = bdk(["hooks", "session-end", "--json"], root, {
      stdin: JSON.stringify({ hook_event_name: "SessionEnd", reason: "other" }),
    });
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      reason: "other",
      checkpoint: { done: false, skipped: expect.stringMatching(/rebase/) as string },
    });
    expect(git(root, "rev-parse", "HEAD")).toBe(before);
  });
});
