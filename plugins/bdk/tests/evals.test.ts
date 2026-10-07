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
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Free checks of the eval suite (spec skill-evals, design D6 of v3-189-eval-setup). Paid runs
// never happen here: the loader check runs `claude plugin eval` at a cost ceiling of zero, which
// loads every case and starts no run.

const PLUGIN = join(import.meta.dirname, "..");
const REPO = join(PLUGIN, "..", "..");
const EVALS = join(PLUGIN, "evals");
const CLAUDE = join(REPO, "node_modules", ".bin", "claude");
const NOT_CASES = new Set(["fixtures", "results"]);
// The grants the eval README recommends; a grader that cannot pass with them is a broken case.
const GRANTS = ["Write", "Edit"];
const SCAFFOLD_LIMIT_MS = 120_000;

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "bdk-evals-"));
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function fresh(name: string): string {
  const dir = mkdtempSync(join(scratch, `${name}-`));
  mkdirSync(join(dir, "home"));
  return dir;
}

/** The case directories of a suite. */
function cases(evals: string): string[] {
  return readdirSync(evals, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_CASES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** Loads a plugin's suite with the pinned loader, at zero cost and with no credentials. */
function load(plugin: string): { status: number | null; stderr: string; result: unknown } {
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
      ...GRANTS,
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
function scaffold(script: string): { status: number | null; stderr: string; dir: string } {
  const root = fresh("scaffold");
  const dir = join(root, "workspace");
  mkdirSync(dir);
  const { status, stderr } = spawnSync("bash", [script], {
    cwd: dir,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: join(root, "home"), TMPDIR: root, TERM: "dumb" },
    timeout: SCAFFOLD_LIMIT_MS,
  });
  return { status, stderr, dir };
}

function frontmatter(file: string): string {
  return /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf8"))?.[1] ?? "";
}

function tags(caseDir: string): string[] {
  const list = /^tags:\s*\[(.*)\]\s*$/m.exec(frontmatter(join(caseDir, "prompt.md")))?.[1] ?? "";
  return list
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

function graderTypes(caseDir: string): string[] {
  const dir = join(caseDir, "graders");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => /^type:\s*(\S+)/m.exec(frontmatter(join(dir, file)))?.[1] ?? "");
}

function scaffoldScript(caseDir: string): string | undefined {
  const yaml = join(caseDir, "case.yaml");
  if (!existsSync(yaml)) return undefined;
  const name = /^\s+scaffold_script:\s*(\S+)\s*$/m.exec(readFileSync(yaml, "utf8"))?.[1];
  return name === undefined ? undefined : join(caseDir, name);
}

describe("eval suite loader check", () => {
  it("loads every case of plugins/bdk with no problem, no run and no cost", () => {
    const { status, stderr, result } = load(PLUGIN);
    expect(problems(stderr)).toEqual([]);
    // Exit 2 with partialReason cost_ceiling: the suite loaded and the zero ceiling stopped
    // every run before it started.
    expect(status).toBe(2);
    expect(result).toMatchObject({ partial: true, partialReason: "cost_ceiling", costUsd: 0 });
  });

  it("detects a broken case, so a loader upgrade cannot make the check pass silently", () => {
    const plugin = join(fresh("planted"), "plugin");
    cpSync(join(PLUGIN, ".claude-plugin"), join(plugin, ".claude-plugin"), { recursive: true });
    cpSync(EVALS, join(plugin, "evals"), {
      recursive: true,
      filter: (src) => !src.startsWith(join(EVALS, "results")),
    });
    const unknownKey = join(plugin, "evals", "planted-unknown-key");
    mkdirSync(join(unknownKey, "graders"), { recursive: true });
    writeFileSync(join(unknownKey, "prompt.md"), "---\nbogus: 1\n---\n\nHello.\n");
    writeFileSync(join(unknownKey, "graders", "any.md"), "---\ntype: llm\n---\n\nPASS always.\n");
    const ungranted = join(plugin, "evals", "planted-ungranted");
    mkdirSync(join(ungranted, "graders"), { recursive: true });
    writeFileSync(
      join(ungranted, "prompt.md"),
      "---\nallowed_tools: [Read, Bash]\n---\n\nHello.\n",
    );
    writeFileSync(join(ungranted, "graders", "ran.md"), "---\ntype: tool_used\ntool: Bash\n---\n");

    const found = problems(load(plugin).stderr).join("\n");
    expect(found).toContain("planted-unknown-key");
    expect(found).toContain("failed to load");
    expect(found).toMatch(/planted-ungranted.*cannot pass/);
  });
});

describe("eval suite fixtures", () => {
  const fixtures = readdirSync(join(EVALS, "fixtures"))
    .filter((file) => file.endsWith(".sh"))
    .sort();

  it("has at least one shared fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)(
    "fixtures/%s builds a workspace in an empty directory",
    (file) => {
      const { status, stderr, dir } = scaffold(join(EVALS, "fixtures", file));
      expect(stderr).toBe("");
      expect(status).toBe(0);
      expect(readdirSync(dir).length).toBeGreaterThan(0);
    },
    SCAFFOLD_LIMIT_MS + 10_000,
  );

  it.each(cases(EVALS).filter((name) => scaffoldScript(join(EVALS, name)) !== undefined))(
    "%s: its scaffold_script exits 0",
    (name) => {
      const script = scaffoldScript(join(EVALS, name));
      expect(script).toBeDefined();
      if (script === undefined) return;
      expect(existsSync(script)).toBe(true);
      const { status, stderr } = scaffold(script);
      expect(stderr).toBe("");
      expect(status).toBe(0);
    },
    SCAFFOLD_LIMIT_MS + 10_000,
  );
});

describe("eval suite layout", () => {
  const names = cases(EVALS);

  it("has cases", () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(names)("%s is named <block>-<case> and holds a case", (name) => {
    expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)+$/);
    const dir = join(EVALS, name);
    expect(existsSync(join(dir, "prompt.md")) || existsSync(join(dir, "case.yaml"))).toBe(true);
  });

  it.each(names)("%s carries exactly one of the tags block, orchestrator, sample", (name) => {
    const kinds = tags(join(EVALS, name)).filter((tag) =>
      ["block", "orchestrator", "sample"].includes(tag),
    );
    expect(kinds).toHaveLength(1);
  });

  it.each(names.filter((name) => tags(join(EVALS, name)).includes("block")))(
    "%s grades the result and the steps",
    (name) => {
      const types = graderTypes(join(EVALS, name));
      expect(types.some((type) => ["file_exists", "regex", "llm"].includes(type))).toBe(true);
      expect(types.some((type) => ["tool_used", "tool_order"].includes(type))).toBe(true);
    },
  );

  it.each(names.filter((name) => tags(join(EVALS, name)).includes("orchestrator")))(
    "%s grades the order of its blocks and the files it writes",
    (name) => {
      const types = graderTypes(join(EVALS, name));
      expect(types).toContain("tool_order");
      expect(types).toContain("file_exists");
    },
  );

  it("keeps run results out of git", () => {
    const { status } = spawnSync(
      "git",
      ["check-ignore", "--quiet", "plugins/bdk/evals/results/2026-01-01T00-00-00-000Z/x.json"],
      { cwd: REPO },
    );
    expect(status).toBe(0);
  });
});

describe("offline gh stand-in", () => {
  const GH = join(EVALS, "fixtures", "bin", "gh");
  const ISSUE = {
    number: 42,
    title: "Export the ledger as CSV",
    body: "## Goal\nExport.",
    labels: [{ id: "L1", name: "enhancement", description: "", color: "a2eeef" }],
    state: "OPEN",
    url: "https://github.com/acme/tiny-ledger/issues/42",
  };

  /** A git workspace whose scaffold wrote issue 42, the way a case scaffold does. */
  function workspace(): string {
    const dir = join(fresh("gh"), "workspace");
    mkdirSync(join(dir, ".git", "bdk-eval", "issues"), { recursive: true });
    writeFileSync(join(dir, ".git", "bdk-eval", "issues", "42.json"), JSON.stringify(ISSUE));
    mkdirSync(join(dir, "src"));
    return dir;
  }

  function gh(cwd: string, ...args: string[]) {
    return spawnSync(GH, args, { cwd, encoding: "utf8", env: { PATH: process.env.PATH } });
  }

  it("prints only the --json fields, from a subdirectory too", () => {
    const { status, stdout } = gh(
      join(workspace(), "src"),
      "issue",
      "view",
      "#42",
      "--json",
      "number,title",
    );
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ number: 42, title: "Export the ledger as CSV" });
  });

  it.each([["42"], ["https://github.com/acme/tiny-ledger/issues/42"], ["acme/tiny-ledger#42"]])(
    "resolves the reference %s",
    (ref) => {
      const { status, stdout } = gh(workspace(), "issue", "view", ref, "--json", "url");
      expect(status).toBe(0);
      expect(JSON.parse(stdout)).toEqual({ url: ISSUE.url });
    },
  );

  it("accepts --repo and -R before or after the number", () => {
    const dir = workspace();
    expect(
      gh(dir, "issue", "view", "--repo", "acme/tiny-ledger", "42", "--json", "state").status,
    ).toBe(0);
    expect(gh(dir, "issue", "view", "42", "-R", "acme/tiny-ledger", "--json", "state").status).toBe(
      0,
    );
  });

  it("prints title, state and body as text without --json", () => {
    const { status, stdout } = gh(workspace(), "issue", "view", "42");
    expect(status).toBe(0);
    expect(stdout).toContain("title:\tExport the ledger as CSV");
    expect(stdout).toContain("state:\tOPEN");
    expect(stdout).toContain("labels:\tenhancement");
    expect(stdout).toContain("## Goal\nExport.");
  });

  it("fails like gh for an issue the scaffold did not write", () => {
    const { status, stderr } = gh(workspace(), "issue", "view", "7");
    expect(status).toBe(1);
    expect(stderr).toContain(
      "GraphQL: Could not resolve to an issue or pull request with the number of 7.",
    );
  });

  it("refuses every other command and names itself", () => {
    const { status, stderr } = gh(workspace(), "pr", "list");
    expect(status).toBe(1);
    expect(stderr).toContain("offline gh stand-in");
  });
});
