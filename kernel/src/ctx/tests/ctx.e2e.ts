// `kernel-cli/ctx` through the built bundle: every exit code and rule of
// `ctx skill`, `ctx startup` and `ctx craft`, and the acceptance scenarios of T13 on the
// plugin's own rules, fragments and STARTUP file. PATH holds only what a case
// installs, so the machine's own lavish-axi never leaks into a case.
import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { REPO_ROOT, runBdk } from "../../../tests/support/run.ts";
import { validatorFor } from "../../../tests/support/schemas.ts";

const validCtx = validatorFor("output/ctx.json");
const validRefusal = validatorFor("common/refusal.json");

const STARTUP = readFileSync(join(REPO_ROOT, "STARTUP_INSTRUCTIONS.md"), "utf8");

const fixtures: Fixture[] = [];
function fixture(files: Record<string, string> = {}, git = true): Fixture {
  const created = createFixture({ files, git });
  fixtures.push(created);
  return created;
}
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

function bdk(args: readonly string[], root: string, path = "") {
  const env = { XDG_CONFIG_HOME: join(root, "xdg"), HOME: root, PATH: path };
  return runBdk(args, root, { env });
}

function stop(result: ReturnType<typeof bdk>, fragment: string) {
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/^BDK STOP: /);
  expect(result.stdout).toContain(fragment);
  expect(result.stdout).toMatch(/\nInstead: .+\n$/);
}

describe("bdk ctx skill", () => {
  it("prints the heading and the sections of the manifest entry", () => {
    const result = bdk(["ctx", "skill", "design"], fixture().root);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^## BDK context: design\n\n### Rules: architecture\n/);
    expect(result.stdout).toContain("\n### Rules: engineering-judgment\n");
    expect(result.stdout).toContain("\n### Asking the user\n\n**Decision tier: ask-user**");
  });

  it("answers --json with an object that validates against ctx.json", () => {
    const result = bdk(["ctx", "skill", "design", "--json"], fixture().root);
    expect(result.code).toBe(0);
    expect(validCtx(result.json), JSON.stringify(validCtx.errors)).toBe(true);
    expect(result.json).toMatchObject({
      parts: [
        { kind: "rules", source: "rules/architecture" },
        { kind: "rules", source: "rules/engineering-judgment" },
        { kind: "verifier-policy", source: "policy.verifier" },
        { kind: "fragment", source: "fragments/decision/ask-user" },
      ],
    });
  });

  it("input/not-found: a STOP block naming the closest skill, exit 0", () => {
    const root = fixture().root;
    stop(bdk(["ctx", "skill", "setupp"], root), "setupp is not a skill with a BDK context");
    const json = bdk(["ctx", "skill", "setupp", "--json"], root);
    expect(json.code).toBe(0);
    expect(validRefusal(json.json)).toBe(true);
    expect(json.json).toMatchObject({
      rule: "input/not-found",
      instead: ["bdk ctx skill setup", "check the skill name in the context lines"],
    });
  });

  it("policy/unknown-config-key: a STOP block, exit 0 [AC-9]", () => {
    const root = fixture({ ".bdk/settings.yaml": "tools:\n  tests: []\n" }).root;
    stop(bdk(["ctx", "skill", "setup"], root), "tools.tests in the project layer");
  });

  it("policy/config-invalid: a STOP block, exit 0", () => {
    const root = fixture({ ".bdk/settings.yaml": "features:\n  lavish: maybe\n" }).root;
    stop(bdk(["ctx", "skill", "design"], root), "features.lavish in the project layer");
  });

  it("runtime/not-a-repo: a STOP block outside a git work tree, exit 0", () => {
    stop(bdk(["ctx", "skill", "design"], fixture({}, false).root), "is not inside a git work tree");
  });

  it("acceptance: byte-identical output with and without features.code-review-graph", () => {
    const without = bdk(
      ["ctx", "skill", "design"],
      fixture({ ".bdk/settings.yaml": "languages: [typescript]\n" }).root,
    );
    const withKey = bdk(
      ["ctx", "skill", "design"],
      fixture({
        ".bdk/settings.yaml": "languages: [typescript]\nfeatures:\n  code-review-graph: true\n",
      }).root,
    );
    expect(without.code).toBe(0);
    expect(withKey.stdout).toBe(without.stdout);
    expect(withKey.stdout).not.toContain("BDK STOP");
  });

  it("acceptance: features.lavish false gives the AskUserQuestion fragment", () => {
    const root = fixture({
      ".bdk/settings.yaml": "features:\n  lavish: false\n",
      "bin/lavish-axi": "#!/bin/sh\n",
    }).root;
    chmodSync(join(root, "bin/lavish-axi"), 0o755);
    const result = bdk(["ctx", "skill", "design"], root, join(root, "bin"));
    expect(result.stdout).toContain("**Decision tier: ask-user**");
    expect(result.stdout).not.toContain("**Decision tier: lavish**");
  });

  it("gives the Lavish fragment when switched on and lavish-axi is on PATH", () => {
    const root = fixture({ "bin/lavish-axi": "#!/bin/sh\n" }).root;
    chmodSync(join(root, "bin/lavish-axi"), 0o755);
    const result = bdk(["ctx", "skill", "design"], root, join(root, "bin"));
    expect(result.stdout).toContain("**Decision tier: lavish**");
  });

  it("prints the project's tool entries with their when text", () => {
    const root = fixture({
      ".bdk/settings.yaml":
        "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: pnpm test:unit\n      when: before every commit\n",
    }).root;
    const result = bdk(["ctx", "skill", "setup"], root);
    expect(result.stdout).toContain(
      "### Project commands: test\n\n- id: unit\n  command: pnpm test:unit\n  when: before every commit\n  tier: fast\n",
    );
    expect(result.stdout).toContain("### Project commands: lint\n\nunset: no command configured\n");
  });
});

describe("bdk ctx craft", () => {
  // The bundle runs with CLAUDE_PLUGIN_ROOT at this repository, whose
  // checkout holds plugins/bdk-craft; HOME is the fixture, so no cache.
  const shipped = readdirSync(join(REPO_ROOT, "plugins", "bdk-craft", "skills")).sort();
  const name = shipped[0] ?? "tdd";

  it("prints a craft skill of the checkout, outside a git work tree, exit 0", () => {
    const result = bdk(["ctx", "craft", name, "--json"], fixture({}, false).root);
    expect(result.code).toBe(0);
    expect(validCtx(result.json)).toBe(true);
    const report = result.json as { content: string; parts: unknown };
    expect(report.content.startsWith(`## Craft: ${name}\n\n## `)).toBe(true);
    expect(report.parts).toStrictEqual([{ kind: "craft", source: `bdk-craft/${name}` }]);
  });

  it("input/not-found: exit 3 with the searched paths", () => {
    const result = bdk(["ctx", "craft", "no-such-skill", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(validRefusal(result.json)).toBe(true);
    const refusal = result.json as { rule: string; why: string };
    expect(refusal.rule).toBe("input/not-found");
    expect(refusal.why).toContain(join(REPO_ROOT, "plugins", "bdk-craft", "skills"));
  });
});

describe("bdk ctx startup", () => {
  it("prints the committed STARTUP_INSTRUCTIONS.md, which is the rendered file", () => {
    const result = bdk(["ctx", "startup"], fixture().root);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(STARTUP);
  });

  it("answers --json with an object that validates against ctx.json", () => {
    const result = bdk(["ctx", "startup", "--json"], fixture().root);
    expect(validCtx(result.json), JSON.stringify(validCtx.errors)).toBe(true);
  });

  it("runs outside a git work tree", () => {
    const result = bdk(["ctx", "startup"], fixture({}, false).root);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(STARTUP);
  });

  it("policy/unknown-config-key: no STOP block, because it reads no configuration", () => {
    const result = bdk(["ctx", "startup"], fixture({ ".bdk/settings.yaml": "nope: 1\n" }).root);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(STARTUP);
  });
});

// `kernel-cli`, Output modes, scenario "kernel unavailable in a skill block":
// the host runs a skill's `!` line through a shell, so run the committed line
// of `design` the same way, once without and once with node on PATH.
describe("context line of a skill in a shell", () => {
  const line = readFileSync(join(REPO_ROOT, "skills/stages/design/SKILL.md"), "utf8")
    .split("\n")
    .find((text) => text.startsWith("!`bdk "));
  const command = (line ?? "").slice(2, -1);
  const launcherDir = join(REPO_ROOT, "bin");
  const run = (path: string) =>
    spawnSync("/bin/sh", ["-c", command], {
      cwd: fixture().root,
      encoding: "utf8",
      env: { PATH: path },
    });

  it("ends with the kernel-unavailable STOP line and exits 0 without bdk on PATH", () => {
    const result = run(dirname(process.execPath));
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /BDK STOP: kernel unavailable \(exit 127\)\. Install Node >= 22\.13 and run \/bdk:setup\.\n$/,
    );
  });

  it("ends with the launcher's line and the STOP line with exit 5 without node", () => {
    const result = run(`${launcherDir}:${fixture({}, false).root}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("bdk: kernel unavailable: node is not on PATH");
    expect(result.stdout).toMatch(
      /BDK STOP: kernel unavailable \(exit 5\)\. Install Node >= 22\.13 and run \/bdk:setup\.\n$/,
    );
  });

  it("prints the skill's BDK context with bdk and node on PATH", () => {
    const result = run(`${launcherDir}:${dirname(process.execPath)}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^## BDK context: design\n/);
  });
});
