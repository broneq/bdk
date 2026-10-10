import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/index.ts";
import { planGroup } from "../src/plan/index.ts";
import { checkResult } from "../src/plan/schema/check.ts";
import type { CheckResult } from "../src/plan/schema/check.ts";
import { runGroup } from "../src/run/index.ts";
import { run } from "../src/shared/cli/index.ts";
import { files } from "../src/shared/fs/index.ts";

// The B1-sized fixture (spec skill-evals, "B1-sized fixture"; design D6 of v3-243-b1-eval-fixture,
// D2 of v3-208-measure-speed-b1, D1 of v3-368-measure-spec-conformance-run): what the four states must hold beyond building, so an edit of a part, a spec delta or the
// default part limits cannot break the fixture silently.

const FIXTURES = join(import.meta.dirname, "..", "evals", "fixtures");
const CHANGE = "openspec/changes/add-household-book";
const PARTS = `${CHANGE}/plan/parts`;
const BUILD_LIMIT_MS = 120_000;

let scratch: string;
let ready: string;
let planned: string;
let queued: string;
let uncorrected: string;
let gap: string;

/** Builds a fixture the way the harness runs a scaffold: empty directory, minimal env. */
function build(script: string): string {
  const root = mkdtempSync(join(scratch, "build-"));
  const dir = join(root, "workspace");
  mkdirSync(dir);
  const { status, stderr } = spawnSync("bash", [join(FIXTURES, script)], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: root, TMPDIR: root, TERM: "dumb" },
    timeout: BUILD_LIMIT_MS,
  });
  expect({ status, stderr }).toEqual({ status: 0, stderr: "" });
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  return spawnSync("git", args, { cwd, encoding: "utf8" }).stdout;
}

async function planCheck(cwd: string): Promise<{ code: number; result: CheckResult }> {
  let stdout = "";
  const code = await run({
    argv: ["plan", "check", PARTS, "--json"],
    version: "0.0.0",
    nodeVersion: process.versions.node,
    groups: [planGroup({ files, cwd, home: join(cwd, "..", "home"), env: {} })],
    stdout: (text) => (stdout += text),
    stderr: () => undefined,
  });
  return { code, result: checkResult.parse(JSON.parse(stdout)) };
}

/** Every scenario of the Change's spec deltas, as `<capability> / <requirement> / <scenario>`. */
function specScenarios(dir: string): string[] {
  const specs = join(dir, CHANGE, "specs");
  const found: string[] = [];
  for (const capability of readdirSync(specs).sort()) {
    let requirement = "";
    for (const line of readFileSync(join(specs, capability, "spec.md"), "utf8").split("\n")) {
      requirement = /^### Requirement: (.+)$/.exec(line)?.[1] ?? requirement;
      const scenario = /^#### Scenario: (.+)$/.exec(line)?.[1];
      if (scenario !== undefined) found.push(`${capability} / ${requirement} / ${scenario}`);
    }
  }
  return found;
}

/** The acceptance scenarios each part names, keyed by part file. */
function ownedScenarios(dir: string): Map<string, string[]> {
  const owned = new Map<string, string[]>();
  for (const file of readdirSync(join(dir, PARTS)).sort()) {
    const text = readFileSync(join(dir, PARTS, file), "utf8");
    const section = /## Acceptance scenarios\n([\s\S]*?)\n## /.exec(text)?.[1] ?? "";
    owned.set(
      file,
      [...section.matchAll(/^- `([^`]+)` \/ Requirement: (.+) \/ Scenario: (.+)$/gm)].map(
        ([, capability, requirement, scenario]) =>
          `${String(capability)} / ${String(requirement)} / ${String(scenario)}`,
      ),
    );
  }
  return owned;
}

/** The `files` frontmatter list of a part. */
function partFiles(text: string): string[] {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
  return [...frontmatter.matchAll(/^ {2}- (.+)$/gm)].map(([, path]) => String(path));
}

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "bdk-household-book-"));
  ready = build("household-book.sh");
  planned = build("household-book-planned.sh");
  queued = build("household-book-queued.sh");
  uncorrected = build("household-book-uncorrected.sh");
  gap = build("../plan-draft-household-book-gap/scaffold.sh");
}, 5 * BUILD_LIMIT_MS);

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("household-book.sh: ready to plan", () => {
  it("holds the Change with proposal, design and spec deltas, and no plan", () => {
    for (const path of ["proposal.md", "design.md", "specs/ledger/spec.md"]) {
      expect(existsSync(join(ready, CHANGE, path))).toBe(true);
    }
    expect(existsSync(join(ready, CHANGE, "plan"))).toBe(false);
  });

  it("holds an approved design: the gate names the last report, which passes", () => {
    const runs = join(ready, ".bdk/runs/add-household-book/design");
    const last = Math.max(
      ...readdirSync(runs).map((name) => Number(/^verify-(\d+)\.md$/.exec(name)?.[1] ?? 0)),
    );
    const report = `verify-${String(last)}.md`;
    expect(readFileSync(join(runs, report), "utf8")).toMatch(/^Verdict: PASS\n/);
    expect(readFileSync(join(runs, "gate.md"), "utf8")).toBe(
      `Gate: approved\nBy: user\nReport: design/${report}\n`,
    );
  });

  it("keeps the run records out of the project's commits", () => {
    const { stdout } = spawnSync("git", ["status", "--porcelain", "--ignored"], {
      cwd: ready,
      encoding: "utf8",
    });
    expect(stdout).toBe("!! .bdk/runs/\n");
  });

  it("is a product whose own tests pass", () => {
    const { status, stdout } = spawnSync("npm", ["test"], { cwd: ready, encoding: "utf8" });
    expect(stdout).toMatch(/\bfail 0\b/);
    expect(status).toBe(0);
  });
});

describe("household-book-planned.sh: ready to execute", () => {
  it("passes bdk plan check with 7 parts in 3 waves", async () => {
    const { code, result } = await planCheck(planned);
    expect(result.problems).toEqual([]);
    expect(code).toBe(0);
    expect(result.parts).toHaveLength(7);
    expect(result.waves).toEqual([
      { wave: 1, parts: ["01"] },
      { wave: 2, parts: ["02", "03", "04", "05", "06"] },
      { wave: 3, parts: ["07"] },
    ]);
  });

  it("has the size of B1: 27 tasks and 62 distinct files", async () => {
    const { result } = await planCheck(planned);
    expect(result.parts.reduce((sum, part) => sum + part.tasks, 0)).toBe(27);
    const paths = readdirSync(join(planned, PARTS)).flatMap((file) =>
      partFiles(readFileSync(join(planned, PARTS, file), "utf8")),
    );
    expect(new Set(paths).size).toBe(62);
    expect(paths).toHaveLength(62);
  });

  it("names every scenario of the spec deltas in exactly one part", () => {
    const scenarios = specScenarios(planned);
    const named = [...ownedScenarios(planned).values()].flat();
    expect(named.filter((name) => !scenarios.includes(name))).toEqual([]);
    expect([...named].sort()).toEqual([...scenarios].sort());
  });

  it("adds the plan and its passing check report in one commit on top of the ready state", () => {
    const { stdout } = spawnSync("git", ["log", "--format=%s"], { cwd: planned, encoding: "utf8" });
    expect(stdout.split("\n").slice(0, 2)).toEqual([
      "docs: plan add-household-book",
      "docs: propose and design add-household-book",
    ]);
    const report = join(planned, ".bdk/runs/add-household-book/plan/verify-1.md");
    expect(readFileSync(report, "utf8")).toMatch(/^Verdict: PASS\n/);
  });
});

describe("household-book-queued.sh: ready for an unattended plan-to-PR run", () => {
  it("puts add-household-book at execute in the run's queue", async () => {
    let stdout = "";
    const code = await run({
      argv: ["run", "status", "--json"],
      version: "0.0.0",
      nodeVersion: process.versions.node,
      groups: [runGroup({ files, cwd: queued })],
      stdout: (text) => (stdout += text),
      stderr: () => undefined,
    });
    expect(code).toBe(0);
    const status = JSON.parse(stdout) as {
      mode: string;
      changes: { change: string; stage: string }[];
    };
    expect(status.mode).toBe("non-interactive");
    expect(status.changes.map(({ change, stage }) => ({ change, stage }))).toEqual([
      { change: "add-household-book", stage: "execute" },
    ]);
  });

  it("keeps the planned commit, a clean tree and main pushed to origin", () => {
    expect(git(queued, "log", "--format=%s")).toBe(git(planned, "log", "--format=%s"));
    expect(git(queued, "status", "--porcelain")).toBe("");
    expect(git(queued, "rev-parse", "origin/main")).toBe(git(queued, "rev-parse", "main"));
    expect(git(queued, "symbolic-ref", "refs/remotes/origin/HEAD")).toBe(
      "refs/remotes/origin/main\n",
    );
    expect(existsSync(join(queued, ".git/bdk-eval/bin/gh"))).toBe(true);
  });

  it("runs unattended: auto gates, decide-and-record, a foreground lead", () => {
    const config = loadConfig({ files, cwd: queued, home: join(queued, "..", "home"), env: {} });
    expect(config.status).toBe("ok");
    if (config.status !== "ok") return;
    expect(config.settings.policy.gates).toEqual({ design: "auto", review: "auto" });
    expect(config.settings.policy.questions).toBe("decide-and-record");
    expect(config.settings.execution.lead).toBe("foreground");
  });
});

describe("household-book-uncorrected.sh: queued as run 1 of the B1 measurement found it", () => {
  const OPTIONS = "specs/ledger/spec.md";
  const IMPORT_PART = `${PARTS}/04.md`;
  const DESIGN_RUNS = ".bdk/runs/add-household-book/design";

  it("documents no shared argument errors and reads the statement under the current directory", () => {
    expect(readFileSync(join(queued, CHANGE, OPTIONS), "utf8")).toContain("import needs a file");
    expect(readFileSync(join(uncorrected, CHANGE, OPTIONS), "utf8")).not.toContain(
      "import needs a file",
    );
    expect(readFileSync(join(uncorrected, CHANGE, "design.md"), "utf8")).not.toContain(
      "without a positional argument",
    );
    const importPart = readFileSync(join(uncorrected, IMPORT_PART), "utf8");
    expect(importPart).toContain("reads join(io.cwd, file)");
    expect(importPart).not.toContain("resolve(");
  });

  it("keeps the design gate on verify-2.md and every scenario of the queued state", () => {
    expect(readFileSync(join(uncorrected, DESIGN_RUNS, "gate.md"), "utf8")).toBe(
      "Gate: approved\nBy: user\nReport: design/verify-2.md\n",
    );
    expect(existsSync(join(uncorrected, DESIGN_RUNS, "verify-3.md"))).toBe(false);
    expect(specScenarios(uncorrected)).toEqual(specScenarios(queued));
  });

  it("passes bdk plan check as the queued state does", async () => {
    const { code, result } = await planCheck(uncorrected);
    expect(result.problems).toEqual([]);
    expect(code).toBe(0);
  });

  it("folds the difference into the planned commit, pushed, with a clean tree", () => {
    expect(git(uncorrected, "log", "--format=%s")).toBe(git(queued, "log", "--format=%s"));
    expect(git(uncorrected, "status", "--porcelain")).toBe("");
    expect(git(uncorrected, "rev-parse", "origin/main")).toBe(
      git(uncorrected, "rev-parse", "main"),
    );
    expect(existsSync(join(uncorrected, ".bdk/runs/run.json"))).toBe(true);
    expect(existsSync(join(uncorrected, ".bdk/settings.local.yaml"))).toBe(true);
  });
});

/** Every file under `dir`, as paths relative to it. */
function tree(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
}

// The case plan-draft-household-book-gap (spec skill-evals, "plan-draft design-gap case on the
// B1-sized fixture"; design D1, D2 of v3-253-measure-plan-draft-gap): one product choice open.
describe("plan-draft-household-book-gap: the short-month choice is open", () => {
  const RECURRING = "specs/ledger-recurring/spec.md";

  it("accepts recurring days 1 to 31", () => {
    const spec = readFileSync(join(gap, CHANGE, RECURRING), "utf8");
    expect(spec).toContain("`<day>` SHALL be a whole number from 1 to 31");
    expect(spec).toContain("ledger recurring add -900 Rent --day 32");
    expect(spec).toContain("it prints `ledger: day must be 1 to 31` to stderr and exits 2");
  });

  it("names neither the old range nor a short-month rule in the Change or its records", () => {
    const rule = /1 to 28|29-31|--day 31\b|last day|clamp|every month has/i;
    const naming = [CHANGE, ".bdk/runs/add-household-book"].flatMap((root) =>
      tree(join(gap, root))
        .filter((path) => rule.test(readFileSync(join(gap, root, path), "utf8")))
        .map((path) => `${root}/${path}`),
    );
    expect(naming).toEqual([]);
  });

  it("keeps the 71 scenarios and holds no plan", () => {
    expect(specScenarios(gap)).toEqual(specScenarios(ready));
    expect(specScenarios(gap)).toHaveLength(71);
    expect(existsSync(join(gap, CHANGE, "plan"))).toBe(false);
  });

  it("changes no other file of the Change", () => {
    const files = tree(join(ready, CHANGE));
    expect(tree(join(gap, CHANGE))).toEqual(files);
    for (const path of files.filter((file) => file !== RECURRING && file !== "design.md")) {
      expect({ path, text: readFileSync(join(gap, CHANGE, path), "utf8") }).toEqual({
        path,
        text: readFileSync(join(ready, CHANGE, path), "utf8"),
      });
    }
  });

  it("is committed into the fixture's history, the tree clean", () => {
    expect(git(gap, "log", "--format=%s")).toBe(git(ready, "log", "--format=%s"));
    const { stdout } = spawnSync("git", ["status", "--porcelain", "--ignored"], {
      cwd: gap,
      encoding: "utf8",
    });
    expect(stdout).toBe("!! .bdk/runs/\n");
  });
});
