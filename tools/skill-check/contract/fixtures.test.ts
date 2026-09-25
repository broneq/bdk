// Seeded violations (spec `skill-content-checks`): `fixtures/clean/` passes every
// rule of the fixture config, and each `fixtures/violations/<rule-id>/`, copied
// over the clean tree, breaks exactly that rule. Runs the installed kit's CLI.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "..", "..", "..");
const FIXTURES = join(REPO, "tools", "skill-check", "fixtures");
const CONFIG = join(FIXTURES, "skill-check.fixture.config.ts");
const CLI = join(REPO, "node_modules", "bdk-skill-kit", "dist", "skill-check.mjs");

// Rule IDs are directory names; a plugin rule `bdk/x` sits at `violations/bdk/x/`.
function violationIds(): string[] {
  const dir = join(FIXTURES, "violations");
  return readdirSync(dir)
    .flatMap((name) =>
      name === "bdk" ? readdirSync(join(dir, name)).map((rule) => `bdk/${rule}`) : [name],
    )
    .sort();
}

// The config's targets resolve against its own directory, so each run gets a
// temporary tree with a one-line config that re-exports the fixture config.
function materialise(rule?: string): string {
  const root = mkdtempSync(join(tmpdir(), "bdk-skill-check-"));
  cpSync(join(FIXTURES, "clean"), root, { recursive: true });
  if (rule !== undefined) cpSync(join(FIXTURES, "violations", rule), root, { recursive: true });
  writeFileSync(
    join(root, "skill-check.config.mjs"),
    `export { default } from ${JSON.stringify(pathToFileURL(CONFIG).href)};\n`,
  );
  return root;
}

interface Finding {
  rule: string;
  file: string;
  line: number;
  message: string;
}

function check(root: string, args: string[] = ["--json"]) {
  const run = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8" });
  expect(run.stderr).toBe("");
  return { code: run.status, stdout: run.stdout };
}

// Type stripping, which loads the TypeScript config and plugin, is on by
// default from Node 22.18; the 22.13 CI line cannot run the CLI with them.
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
const canLoadTypeScript = major > 22 || (major === 22 && minor >= 18);

describe.skipIf(!canLoadTypeScript)("skill-check fixtures (needs Node >= 22.18)", () => {
  it("the clean tree passes every rule", () => {
    const { code, stdout } = check(materialise());
    expect((JSON.parse(stdout) as { findings: Finding[] }).findings).toEqual([]);
    expect(code).toBe(0);
  });

  it("every rule the config enables has exactly one violation fixture", () => {
    const { stdout } = check(materialise(), ["--list-rules", "--json"]);
    expect(violationIds()).toEqual(JSON.parse(stdout));
  });

  it.each(violationIds())("%s: the seeded violation fails only that rule", (rule) => {
    const { code, stdout } = check(materialise(rule));
    const { findings } = JSON.parse(stdout) as { findings: Finding[] };
    expect(findings.length, "the fixture must seed a violation").toBeGreaterThan(0);
    expect(findings.filter((f) => f.rule !== rule)).toEqual([]);
    expect(code).toBe(1);
  });

  it("the portable target rejects a Claude-only field", () => {
    const { stdout } = check(materialise("fields"));
    const { findings } = JSON.parse(stdout) as { findings: Finding[] };
    expect(findings.map((f) => [f.file, f.message.includes("portable profile")])).toEqual([
      ["craft/hidden/SKILL.md", true],
    ]);
  });
});
