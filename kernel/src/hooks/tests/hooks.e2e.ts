// `kernel-cli/hooks` through the committed bundle: the scenarios of
// `hooks session-start` and `hooks skill-exists`. HOME is the fixture, so the
// machine's own skills and plugins never leak into a case.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { REPO_ROOT, runBdk } from "../../../tests/support/run.ts";
import { validatorFor } from "../../../tests/support/schemas.ts";

const validSessionStart = validatorFor("output/hooks-session-start.json");
const validSkillExists = validatorFor("output/hooks-skill-exists.json");

const STARTUP = readFileSync(join(REPO_ROOT, "STARTUP_INSTRUCTIONS.md"), "utf8");
const VERSION = (
  JSON.parse(readFileSync(join(REPO_ROOT, ".claude-plugin/plugin.json"), "utf8")) as {
    version: string;
  }
).version;
const MODELINE = `# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v${VERSION}/schema/settings.json\n`;
const PAYLOAD = JSON.stringify({ hook_event_name: "SessionStart", source: "startup" });

const fixtures: Fixture[] = [];
function fixture(files: Record<string, string> = {}, git = true): Fixture {
  const created = createFixture({ files, git });
  fixtures.push(created);
  return created;
}
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

function bdk(args: readonly string[], root: string) {
  const env = { XDG_CONFIG_HOME: join(root, "xdg"), HOME: root, PATH: "" };
  return runBdk(args, root, { env, stdin: PAYLOAD });
}

function afterStartup(stdout: string): string[] {
  expect(stdout.startsWith(STARTUP.trimEnd())).toBe(true);
  return stdout
    .slice(STARTUP.trimEnd().length)
    .split("\n")
    .filter((line) => line !== "");
}

describe("bdk hooks session-start", () => {
  it("answers --json with an object that validates against its schema", () => {
    const root = fixture({ ".bdk/settings.yaml": MODELINE, ".bdk/settings.json": "{}" }).root;
    const result = bdk(["hooks", "session-start", "--json"], root);
    expect(result.code).toBe(0);
    expect(validSessionStart(result.json), JSON.stringify(validSessionStart.errors)).toBe(true);
    expect(result.json).toMatchObject({ layout: "v2", configProblems: 0 });
  });

  it("starts with the output of bdk ctx startup", () => {
    const root = fixture().root;
    expect(bdk(["hooks", "session-start"], root).stdout).toBe(bdk(["ctx", "startup"], root).stdout);
  });

  it("reports a removed key as a config line, exit 0, no STOP", () => {
    const root = fixture({ ".bdk/settings.yaml": `${MODELINE}features:\n  serena: true\n` }).root;
    const result = bdk(["hooks", "session-start"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("BDK STOP");
    const lines = afterStartup(result.stdout);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[BDK\] config: features\.serena .*removed v2 key: .* Instead: /);
  });

  it("policy/unknown-config-key: a config line, exit 0, no STOP", () => {
    const root = fixture({ ".bdk/settings.yaml": `${MODELINE}tools:\n  tests: []\n` }).root;
    const result = bdk(["hooks", "session-start"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("BDK STOP");
    expect(afterStartup(result.stdout)).toStrictEqual([
      expect.stringMatching(
        /^\[BDK\] config: tools\.tests in the project layer .* Instead: bdk config schema tools; fix \.bdk\/settings\.yaml$/,
      ),
    ]);
  });

  it("policy/config-invalid: a config line, exit 0, no STOP", () => {
    const root = fixture({ ".bdk/settings.yaml": `${MODELINE}features:\n  lavish: maybe\n` }).root;
    const result = bdk(["hooks", "session-start"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("BDK STOP");
    expect(afterStartup(result.stdout)).toStrictEqual([
      expect.stringMatching(/^\[BDK\] config: features\.lavish in the project layer /),
    ]);
  });

  it("stays silent with registered keys, the modeline and no v2 marker", () => {
    const root = fixture({ ".bdk/settings.yaml": `${MODELINE}languages: [go]\n` }).root;
    expect(bdk(["hooks", "session-start"], root).stdout).toBe(STARTUP);
  });

  it("prints STARTUP alone in a repository without .bdk/ and outside a work tree, writing nothing", () => {
    for (const root of [fixture().root, fixture({}, false).root]) {
      const result = bdk(["hooks", "session-start"], root);
      expect(result.code).toBe(0);
      expect(result.stdout).toBe(STARTUP);
      expect(() => readFileSync(join(root, ".bdk/.machine/config/resolved.yaml"))).toThrow();
    }
  });

  it("starts no MCP work", () => {
    const root = fixture({ ".bdk/settings.yaml": MODELINE }).root;
    expect(bdk(["hooks", "session-start"], root).stdout).not.toMatch(/uvx|MCP server/);
  });

  it("finishes within a second on a BDK project", () => {
    const root = fixture({ ".bdk/settings.yaml": `${MODELINE}languages: [go]\n` }).root;
    const start = performance.now();
    bdk(["hooks", "session-start"], root);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe("bdk hooks skill-exists", () => {
  it("finds the skill of an installed plugin version", () => {
    const path = ".claude/plugins/cache/caveman/caveman/2.7.0/skills/caveman-commit/SKILL.md";
    const root = fixture({ [path]: "---\nname: caveman-commit\n---\n" }).root;
    const result = bdk(["hooks", "skill-exists", "caveman-commit", "--json"], root);
    expect(result.code).toBe(0);
    expect(validSkillExists(result.json), JSON.stringify(validSkillExists.errors)).toBe(true);
    expect(result.json).toStrictEqual({
      name: "caveman-commit",
      installed: true,
      foundIn: join(root, path),
      content: "",
    });
    expect(bdk(["hooks", "skill-exists", "caveman-commit"], root).stdout).toBe("");
  });

  it("prints one content line for a missing skill, exit 0", () => {
    const result = bdk(["hooks", "skill-exists", "caveman-commit"], fixture().root);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      "[BDK] skill caveman-commit is not installed; the skill that needs it falls back to its own behaviour.\n",
    );
  });
});
