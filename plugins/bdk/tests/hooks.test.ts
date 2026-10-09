import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { build } from "../build.ts";

// End-to-end test of the plugin's hooks (spec `bdk-cli/hooks`, "Hook registration" and the
// acceptance signal of #182): each command of `hooks/hooks.json` runs through `sh -c` the way
// the host runs it, with `CLAUDE_PLUGIN_ROOT` set and the payload on stdin, against a copy of the
// plugin built outside the workspace.

const PLUGIN = join(import.meta.dirname, "..");

interface HookEntry {
  readonly matcher?: string;
  readonly hooks: readonly { readonly type: string; readonly command: string }[];
}

const HOOKS = (
  JSON.parse(readFileSync(join(PLUGIN, "hooks", "hooks.json"), "utf8")) as {
    hooks: Record<string, readonly HookEntry[]>;
  }
).hooks;

let root: string;
let plugin: string;
let unbuilt: string;
let project: string;
let bare: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "bdk-hooks-"));
  plugin = join(root, "plugin");
  unbuilt = join(root, "unbuilt");
  for (const dir of [".claude-plugin", "bin", "hooks"]) {
    cpSync(join(PLUGIN, dir), join(plugin, dir), { recursive: true });
    cpSync(join(PLUGIN, dir), join(unbuilt, dir), { recursive: true });
  }
  project = join(root, "project");
  mkdirSync(join(project, ".bdk"), { recursive: true });
  mkdirSync(join(project, "openspec"));
  writeFileSync(join(project, ".bdk", "settings.yaml"), "hooks:\n  subagent-git: true\n");
  bare = join(root, "bare");
  mkdirSync(join(bare, ".git"), { recursive: true });
  await build({ outfile: join(plugin, "dist", "bdk.mjs") });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function command(event: string): string {
  const [entry] = HOOKS[event] ?? [];
  const [hook] = entry?.hooks ?? [];
  if (hook === undefined) throw new Error(`no ${event} hook`);
  return hook.command;
}

/** Runs the registered command of `event` as the host does. */
function hook(event: string, payload: object, pluginRoot = plugin) {
  const { status, stdout, stderr } = spawnSync("sh", ["-c", command(event)], {
    cwd: (payload as { cwd?: string }).cwd ?? root,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, XDG_CONFIG_HOME: join(root, "xdg") },
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { status, stdout, stderr };
}

function bash(cwd: string, command: string, agentType?: string) {
  return {
    session_id: "s",
    cwd,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
    ...(agentType === undefined ? {} : { agent_id: "a1", agent_type: agentType }),
  };
}

describe("hooks/hooks.json", () => {
  it("registers SessionStart and a Bash PreToolUse hook on the bundled CLI, and nothing else", () => {
    expect(Object.keys(HOOKS).sort()).toEqual(["PreToolUse", "SessionStart"]);
    expect(HOOKS.PreToolUse?.map((entry) => entry.matcher)).toEqual(["Bash"]);
    expect(command("SessionStart")).toMatch(
      /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/dist\/bdk\.mjs" hooks session-start - /,
    );
    expect(command("PreToolUse")).toMatch(
      /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/dist\/bdk\.mjs" hooks pre-tool-use - /,
    );
  });

  it("refuses a worker subagent's git commit with the guard on", () => {
    const { status, stdout } = hook(
      "PreToolUse",
      bash(project, "git add -A && git commit -m wip", "general-purpose"),
    );
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
    });
  });

  it("lets a bdk:lead commit pass", () => {
    const { status, stdout } = hook("PreToolUse", bash(project, "git commit -m x", "bdk:lead"));
    expect([status, stdout]).toEqual([0, "{}\n"]);
  });

  it("shows one warning in a session without configuration", () => {
    const { status, stdout } = hook("SessionStart", {
      session_id: "s",
      cwd: bare,
      source: "startup",
    });
    expect([status, stdout]).toEqual([
      0,
      '{"systemMessage":"BDK not configured: run /bdk:setup"}\n',
    ]);
  });

  it("gives a configured session its context, naming only skills the plugin ships", () => {
    const { status, stdout } = hook("SessionStart", { session_id: "s", cwd: project });
    expect(status).toBe(0);
    const output = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
    const named = [...output.hookSpecificOutput.additionalContext.matchAll(/\/bdk:([a-z-]+)/g)];
    expect(named.length).toBeGreaterThan(0);
    for (const [, name = ""] of named)
      expect(existsSync(join(PLUGIN, "skills", name, "SKILL.md")), `/bdk:${name}`).toBe(true);
  });

  it("never blocks a tool call when the bundle is missing, and shows a broken session start", () => {
    const guard = hook("PreToolUse", bash(project, "git commit", "general-purpose"), unbuilt);
    expect(guard.status).toBe(1);
    const start = hook("SessionStart", { session_id: "s", cwd: project }, unbuilt);
    expect(start.status).toBe(2);
    expect(start.stderr).not.toBe("");
  });

  it("turns a usage error of the CLI into exit 1, not a block", () => {
    const { status, stdout } = spawnSync("sh", ["-c", command("PreToolUse")], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: plugin },
      input: "not json",
      encoding: "utf8",
    });
    expect([status, stdout]).toEqual([1, ""]);
  });
});
