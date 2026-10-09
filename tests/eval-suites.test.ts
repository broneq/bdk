import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from "vitest";

// Free checks of every plugin's eval suite (spec skill-evals, design D1-D4 of
// v3-318-eval-loader-all-plugins). Paid runs never happen here: the loader runs at a cost
// ceiling of zero, which loads every case and starts no run. Checks that only the bdk suite
// follows stay in plugins/bdk/tests/evals.test.ts.

const REPO = join(import.meta.dirname, "..");
const PLUGINS = join(REPO, "plugins");
const CLAUDE = join(REPO, "node_modules", ".bin", "claude");
const NOT_CASES = new Set(["fixtures", "results"]);
// The tools each plugin's evals/README.md grants in its run command; a grader that cannot pass
// with them is a broken case.
const GRANTS: Record<string, string[]> = {
  bdk: ["Write", "Edit"],
  "bdk-craft": ["Write", "Edit", "Bash"],
  "bdk-skill-kit": ["Bash", "Edit"],
};
const SCAFFOLD_LIMIT_MS = 120_000;

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "bdk-eval-suites-"));
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/**
 * A new directory under the scratch root, deleted when the calling test finishes. Every scaffold
 * is a git repository, so leaving them all for one delete in afterAll made that hook outgrow its
 * timeout as cases were added (#336).
 */
function fresh(name: string): string {
  const dir = mkdtempSync(join(scratch, `${name}-`));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  mkdirSync(join(dir, "home"));
  return dir;
}

/** The case directories of a suite. */
function cases(evals: string): string[] {
  return readdirSync(evals, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !NOT_CASES.has(entry.name) &&
        (existsSync(join(evals, entry.name, "prompt.md")) ||
          existsSync(join(evals, entry.name, "case.yaml"))),
    )
    .map((entry) => entry.name)
    .sort();
}

/** The plugins whose evals/ holds at least one case. */
function suites(): string[] {
  return readdirSync(PLUGINS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const evals = join(PLUGINS, name, "evals");
      return existsSync(evals) && cases(evals).length > 0;
    })
    .sort();
}

/** Loads a plugin's suite with the pinned loader, at zero cost and with no credentials. */
function load(
  plugin: string,
  grants: string[],
): { status: number | null; stderr: string; result: unknown } {
  const dir = fresh("load");
  const { status, stderr } = spawnSync(
    CLAUDE,
    [
      "plugin",
      "eval",
      plugin,
      "--trust-plugin",
      "--scaffold",
      "--max-cost-usd",
      "0",
      "--no-publish",
      "--output-dir",
      join(dir, "out"),
      "--report",
      join(dir, "report.html"),
      "--json",
      join(dir, "result.json"),
      "--allow-tools",
      ...grants,
    ],
    {
      cwd: dir,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: join(dir, "home") },
      timeout: 60_000,
    },
  );
  const json = join(dir, "result.json");
  const result: unknown = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : null;
  return { status, stderr, result };
}

/** Lines of the loader's stderr that report a broken case. */
function problems(stderr: string): string[] {
  return stderr
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("✗") || line.includes("failed to load") || line.includes("cannot pass"),
    );
}

/** Runs a script the way the harness runs a scaffold_script: empty directory, minimal env. */
function scaffold(script: string): { status: number | null; stderr: string } {
  const root = fresh("scaffold");
  const dir = join(root, "workspace");
  mkdirSync(dir);
  const { status, stderr } = spawnSync("bash", [script], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: join(root, "home"), TMPDIR: root, TERM: "dumb" },
    timeout: SCAFFOLD_LIMIT_MS,
  });
  return { status, stderr };
}

function scaffoldScript(caseDir: string): string | undefined {
  const yaml = join(caseDir, "case.yaml");
  if (!existsSync(yaml)) return undefined;
  const name = /^\s+scaffold_script:\s*(\S+)\s*$/m.exec(readFileSync(yaml, "utf8"))?.[1];
  return name === undefined ? undefined : join(caseDir, name);
}

const SUITES = suites();

describe("eval suites", () => {
  it("finds the suites of bdk, bdk-craft and bdk-skill-kit", () => {
    expect(SUITES).toEqual(expect.arrayContaining(["bdk", "bdk-craft", "bdk-skill-kit"]));
  });

  it.each(SUITES)("%s: lists the grants of its eval README", (plugin) => {
    expect(GRANTS[plugin], `no grants for plugins/${plugin}/evals/`).toBeDefined();
  });
});

describe.each(SUITES)("eval suite of plugins/%s", (plugin) => {
  const root = join(PLUGINS, plugin);
  const evals = join(root, "evals");

  it("loads every case with no problem, no run and no cost", () => {
    const { status, stderr, result } = load(root, GRANTS[plugin] ?? []);
    expect(problems(stderr)).toEqual([]);
    // Exit 2 with partialReason cost_ceiling: the suite loaded and the zero ceiling stopped
    // every run before it started.
    expect(status).toBe(2);
    expect(result).toMatchObject({ partial: true, partialReason: "cost_ceiling", costUsd: 0 });
  });

  it.each(cases(evals).filter((name) => scaffoldScript(join(evals, name)) !== undefined))(
    "%s: its scaffold_script exits 0",
    (name) => {
      const script = scaffoldScript(join(evals, name));
      expect(script).toBeDefined();
      if (script === undefined) return;
      expect(existsSync(script), `${plugin}/evals/${name}: no ${script}`).toBe(true);
      const { status, stderr } = scaffold(script);
      expect(stderr).toBe("");
      expect(status).toBe(0);
    },
    SCAFFOLD_LIMIT_MS + 10_000,
  );
});

describe("eval suite check", () => {
  it("detects a broken case, so a loader upgrade cannot make the check pass silently", () => {
    const source = join(PLUGINS, "bdk-skill-kit");
    const plugin = join(fresh("planted"), "plugin");
    cpSync(join(source, ".claude-plugin"), join(plugin, ".claude-plugin"), { recursive: true });
    cpSync(join(source, "evals"), join(plugin, "evals"), {
      recursive: true,
      filter: (src) => !src.startsWith(join(source, "evals", "results")),
    });
    const unknownKey = join(plugin, "evals", "planted-unknown-key");
    mkdirSync(join(unknownKey, "graders"), { recursive: true });
    writeFileSync(join(unknownKey, "prompt.md"), "---\nbogus: 1\n---\n\nHello.\n");
    writeFileSync(join(unknownKey, "graders", "any.md"), "---\ntype: llm\n---\n\nPASS always.\n");
    const ungranted = join(plugin, "evals", "planted-ungranted");
    mkdirSync(join(ungranted, "graders"), { recursive: true });
    writeFileSync(
      join(ungranted, "prompt.md"),
      "---\nallowed_tools: [Read, WebFetch]\n---\n\nHello.\n",
    );
    writeFileSync(
      join(ungranted, "graders", "ran.md"),
      "---\ntype: tool_used\ntool: WebFetch\n---\n",
    );
    const badYaml = join(plugin, "evals", "planted-bad-yaml");
    mkdirSync(badYaml);
    writeFileSync(join(badYaml, "case.yaml"), "schema_version: [\n");

    const found = problems(load(plugin, GRANTS["bdk-skill-kit"] ?? []).stderr).join("\n");
    expect(found).toContain("planted-unknown-key");
    expect(found).toContain("failed to load");
    expect(found).toMatch(/planted-ungranted.*cannot pass/);
    expect(found).toMatch(/planted-bad-yaml.*YAML parse failed/);
  });
});
