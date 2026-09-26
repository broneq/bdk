// `plugin-tooling`, Settings check at session start, scenario "hooks file":
// the plugin registers one SessionStart command that runs the kernel, no Stop
// hook, and no hook command anywhere runs Python.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

const SESSION_START =
  'node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."';

interface HookGroup {
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
