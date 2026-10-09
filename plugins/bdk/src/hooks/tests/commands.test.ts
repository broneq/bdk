import { describe, expect, it } from "vitest";

import { run } from "../../shared/cli/index.ts";
import type { Entry, Files } from "../../shared/fs/index.ts";
import { hooksGroup } from "../index.ts";
import { preToolUseResult } from "../schema/pre-tool-use.ts";
import { sessionStartResult } from "../schema/session-start.ts";

// `bdk hooks` through the frame on in-memory projects (spec `bdk-cli/hooks`): payload input, the
// host output, the session-start context and warning, and every path of the subagent-git guard.

const ROOT = "/work/app";
const OTHER = "/work/other";
const PROJECT = `${ROOT}/.bdk/settings.yaml`;
const OPENSPEC = `${ROOT}/openspec/config.yaml`;

type Tree = Record<string, string>;

/** A file system of `path -> text` that records every path read or listed. */
function memory(tree: Tree): Files & { readonly touched: string[] } {
  const touched: string[] = [];
  return {
    touched,
    readText(path) {
      touched.push(path);
      return tree[path];
    },
    list(dir) {
      touched.push(dir);
      const entries = new Map<string, Entry>();
      for (const path of Object.keys(tree)) {
        if (!path.startsWith(`${dir}/`)) continue;
        const [name = "", ...rest] = path.slice(dir.length + 1).split("/");
        entries.set(name, { name, dir: rest.length > 0 });
      }
      if (entries.size === 0) return undefined;
      return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    writeText: () => {
      throw new Error("hooks never write");
    },
    appendText: () => {
      throw new Error("hooks never write");
    },
  };
}

async function bdk(tree: Tree, payload: unknown, ...argv: string[]) {
  const files = memory(tree);
  let stdout = "";
  let stderr = "";
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const code = await run({
    argv,
    version: "0.0.0",
    nodeVersion: "24.0.0",
    groups: [
      hooksGroup({
        files,
        cwd: OTHER,
        home: "/home/me",
        env: {},
        stdin: () => Promise.resolve(raw),
      }),
    ],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { code, stdout, stderr, touched: files.touched };
}

const CONFIGURED: Tree = { [PROJECT]: "languages: [typescript]\n", [OPENSPEC]: "" };
const GUARDED: Tree = { [PROJECT]: "hooks:\n  subagent-git: true\n", [OPENSPEC]: "" };

function bash(command: string, agent?: { id: string; type: string }) {
  return {
    session_id: "s",
    cwd: ROOT,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command, description: "d" },
    ...(agent === undefined ? {} : { agent_id: agent.id, agent_type: agent.type }),
  };
}

const WORKER = { id: "a1", type: "general-purpose" };
const LEAD = { id: "a2", type: "bdk:lead" };

const guard = (tree: Tree, payload: unknown, ...flags: string[]) =>
  bdk(tree, payload, "hooks", "pre-tool-use", "-", ...flags);

describe("bdk hooks pre-tool-use", () => {
  it("denies a worker's commit with the guard on, exit 0 and the host deny object", async () => {
    const { code, stdout, stderr } = await guard(
      GUARDED,
      bash("git add -A && git commit -m wip", WORKER),
    );
    expect([code, stderr]).toEqual([0, ""]);
    const output = JSON.parse(stdout) as {
      hookSpecificOutput: Record<string, string>;
    };
    expect(output.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain("hooks.subagent-git");
    expect(output.hookSpecificOutput.permissionDecisionReason).toContain("(git commit)");
  });

  it("prints the BDK result under --json, valid against its schema", async () => {
    const deny = await guard(GUARDED, bash("git push", WORKER), "--json");
    const result = preToolUseResult.parse(JSON.parse(deny.stdout));
    expect([result.decision, result.command]).toEqual(["deny", "git push"]);
    const allow = await guard(GUARDED, bash("git status", WORKER), "--json");
    expect(preToolUseResult.parse(JSON.parse(allow.stdout))).toEqual({
      decision: "allow",
      command: null,
      reason: null,
    });
  });

  it.each([
    ["the lead", GUARDED, bash("git commit -m 'part 01'", LEAD)],
    ["the main thread", GUARDED, bash("git commit -m x")],
    ["the guard off by default", CONFIGURED, bash("git commit -m x", WORKER)],
    [
      "an unconfigured project",
      { [PROJECT]: "hooks:\n  subagent-git: true\n" },
      bash("git commit", WORKER),
    ],
    [
      "an invalid configuration",
      { [PROJECT]: "hooks:\n  subagent-git: yes-please\n", [OPENSPEC]: "" },
      bash("git commit", WORKER),
    ],
    ["read-only git", GUARDED, bash("git status && git diff HEAD~1 && git log --oneline", WORKER)],
    [
      "another tool",
      GUARDED,
      { ...bash("x", WORKER), tool_name: "Write", tool_input: { command: "git commit" } },
    ],
    ["a Bash call without a command", GUARDED, { ...bash("x", WORKER), tool_input: {} }],
  ])("allows %s with {}", async (_, tree, payload) => {
    const { code, stdout, stderr } = await guard(tree, payload);
    expect([code, stdout, stderr]).toEqual([0, "{}\n", ""]);
  });

  it("allows the main thread of a session run as an agent (agent_type without agent_id)", async () => {
    const { stdout } = await guard(GUARDED, { ...bash("git commit -m x"), agent_type: "bdk:x" });
    expect(stdout).toBe("{}\n");
  });

  it("reads no file unless a worker's Bash command changes history", async () => {
    for (const payload of [
      bash("git commit -m x"),
      bash("git commit -m x", LEAD),
      bash("git status", WORKER),
    ]) {
      expect((await guard(GUARDED, payload)).touched).toEqual([]);
    }
    expect((await guard(GUARDED, bash("git commit", WORKER))).touched).not.toEqual([]);
  });

  it("resolves the configuration from the payload's cwd, else the process cwd", async () => {
    const elsewhere = { ...bash("git commit", WORKER), cwd: OTHER };
    expect((await guard(GUARDED, elsewhere)).stdout).toBe("{}\n");
    const noCwd = { ...bash("git commit", WORKER), cwd: undefined };
    const tree = {
      [`${OTHER}/.bdk/settings.yaml`]: "hooks:\n  subagent-git: true\n",
      [`${OTHER}/openspec/config.yaml`]: "",
    };
    expect(JSON.parse((await guard(tree, noCwd)).stdout)).toHaveProperty("hookSpecificOutput");
  });

  it.each([["not json"], ["[1, 2]"], ['"text"'], ["null"]])(
    "reports usage/invalid-payload for %s",
    async (raw) => {
      const { code, stdout, stderr } = await guard(GUARDED, raw);
      expect([code, stdout]).toEqual([2, ""]);
      expect(stderr).toContain("hook payload on stdin is not a JSON object");
      const json = await guard(GUARDED, raw, "--json");
      expect(JSON.parse(json.stdout)).toMatchObject({ error: { code: "usage/invalid-payload" } });
    },
  );

  it("takes only - as its argument", async () => {
    const other = await bdk(GUARDED, bash("x"), "hooks", "pre-tool-use", "payload.json", "--json");
    expect(other.code).toBe(2);
    expect(JSON.parse(other.stdout)).toMatchObject({ error: { code: "usage/invalid-argument" } });
    const missing = await bdk(GUARDED, bash("x"), "hooks", "pre-tool-use", "--json");
    expect(JSON.parse(missing.stdout)).toMatchObject({ error: { code: "usage/missing-argument" } });
  });
});

const start = (tree: Tree, payload: unknown, ...flags: string[]) =>
  bdk(tree, payload, "hooks", "session-start", "-", ...flags);

const SESSION = { session_id: "s", cwd: ROOT, hook_event_name: "SessionStart", source: "startup" };

describe("bdk hooks session-start", () => {
  it("gives a configured project the BDK process and the user nothing", async () => {
    const { code, stdout, stderr } = await start(CONFIGURED, SESSION);
    expect([code, stderr]).toEqual([0, ""]);
    const output = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
      systemMessage?: string;
    };
    expect(output.systemMessage).toBeUndefined();
    expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
    const context = output.hookSpecificOutput.additionalContext;
    expect(context.split("\n").length).toBeLessThanOrEqual(6);
    expect(context).toContain("BDK");
    expect(context).toContain(ROOT);
    const stages = ["propose", "design", "plan", "execute", "auto-review", "close"];
    const positions = stages.map((stage) => context.indexOf(`/bdk:${stage}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const command of ["/bdk:run", "/bdk:debug", "/bdk:pr-review"])
      expect(context).toContain(command);
    expect(context).toMatch(/run the same command again/);
    expect(context).toMatch(/small edit .* directly, without a Change/);
  });

  it("names no bdk CLI command in the context", async () => {
    const { stdout } = await start(CONFIGURED, SESSION, "--json");
    const context = sessionStartResult.parse(JSON.parse(stdout)).context;
    expect(context).not.toContain("bdk config show");
    expect(context).not.toContain("bdk --help");
  });

  it("gives the same context with hooks.subagent-git on", async () => {
    const plain = sessionStartResult.parse(
      JSON.parse((await start(CONFIGURED, SESSION, "--json")).stdout),
    );
    const guarded = sessionStartResult.parse(
      JSON.parse((await start(GUARDED, SESSION, "--json")).stdout),
    );
    expect(guarded.context).toBe(plain.context);
    expect(guarded.context).not.toContain("hooks.subagent-git");
  });

  it("gives the same context whatever the run state", async () => {
    const plain = await start(CONFIGURED, SESSION, "--json");
    const busy = await start(
      {
        ...CONFIGURED,
        [`${ROOT}/.bdk/runs/run.json`]:
          '{"version":1,"mode":"interactive","queue":[{"change":"v3-12-foo"}],"current":"v3-12-foo"}',
        [`${ROOT}/openspec/changes/v3-12-foo/proposal.md`]: "# Proposal\n",
      },
      SESSION,
      "--json",
    );
    expect(busy.stdout).toBe(plain.stdout);
    expect(busy.touched.some((path) => path.includes(".bdk/runs"))).toBe(false);
  });

  it("shows one warning and injects nothing without a configuration", async () => {
    const { code, stdout, stderr } = await start({}, SESSION);
    expect([code, stderr]).toEqual([0, ""]);
    expect(stdout).toBe('{"systemMessage":"BDK not configured: run /bdk:setup"}\n');
    const missingOpenSpec = await start({ [PROJECT]: "" }, SESSION);
    expect(missingOpenSpec.stdout).toBe(stdout);
  });

  it("shows one warning and injects nothing with an invalid configuration", async () => {
    const tree = { [PROJECT]: "execution:\n  lead: sideways\n", [OPENSPEC]: "" };
    const { code, stdout } = await start(tree, SESSION);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      systemMessage: "BDK configuration invalid: run bdk config check",
    });
  });

  it("prints the BDK result under --json, valid against its schema", async () => {
    const { stdout } = await start({}, SESSION, "--json");
    expect(sessionStartResult.parse(JSON.parse(stdout))).toEqual({
      status: "not-configured",
      root: ROOT,
      context: null,
      warning: "BDK not configured: run /bdk:setup",
    });
  });

  it("resolves the project from the process cwd when the payload has none", async () => {
    const noCwd = { ...SESSION, cwd: undefined };
    const { stdout } = await start(CONFIGURED, noCwd, "--json");
    expect(sessionStartResult.parse(JSON.parse(stdout)).root).toBe(OTHER);
  });

  it("takes only - as its argument", async () => {
    const { code, stdout } = await bdk(
      CONFIGURED,
      SESSION,
      "hooks",
      "session-start",
      "payload.json",
      "--json",
    );
    expect(code).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({ error: { code: "usage/invalid-argument" } });
  });

  it("reports usage/invalid-payload for a payload that is not a JSON object", async () => {
    const { code, stdout } = await start(CONFIGURED, "", "--json");
    expect(code).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({ error: { code: "usage/invalid-payload" } });
  });
});
