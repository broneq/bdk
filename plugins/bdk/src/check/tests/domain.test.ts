import { describe, expect, it } from "vitest";

import { DEFAULT_TIMEOUT, nulPaths, planChecks, quote, scopeOf } from "../domain/plan.ts";
import type { Kind, Point, Tools } from "../domain/plan.ts";
import { finding, statusOf, tailOf, trailer, verdictOf } from "../domain/verdict.ts";

// Pure rules of spec `bdk-cli/check`, "Run the checks", "Output files", "Red checks as findings".

const TOOLS: Tools = {
  test: [
    { id: "unit", command: "vitest run {files}", when: ["part"] },
    { id: "suite", command: "vitest run", when: ["wave", "review"] },
    { id: "e2e", command: "playwright test", timeout: 900, when: ["review"] },
  ],
  lint: [{ id: "eslint", command: "eslint {files} && tsc --noEmit {files}" }],
  build: [{ id: "tsc", command: "tsc -b", timeout: 120 }],
};

describe("scope", () => {
  it("deduplicates the paths and sorts them by code unit", () => {
    expect(scopeOf(["src/b.ts", "src/a.ts", "Z.ts", "src/b.ts"])).toEqual([
      "Z.ts",
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("is null without paths", () => {
    expect(scopeOf(undefined)).toBeNull();
    expect(scopeOf([])).toBeNull();
  });
});

describe("quote", () => {
  it("leaves a plain path as is", () => {
    expect(quote("src/@scope/a_b-c.d+e=f:g,h%i.ts")).toBe("src/@scope/a_b-c.d+e=f:g,h%i.ts");
  });

  it("quotes any other path in single quotes, escaping a single quote", () => {
    expect(quote("src/a b.ts")).toBe("'src/a b.ts'");
    expect(quote("src/it's.ts")).toBe("'src/it'\\''s.ts'");
    expect(quote("$(rm -rf ~).ts")).toBe("'$(rm -rf ~).ts'");
  });
});

const plan = (
  tools: Tools,
  options: { kinds?: readonly Kind[]; at?: Point; files?: readonly string[] | null } = {},
) => planChecks(tools, { kinds: options.kinds, at: options.at, files: options.files ?? null });

const commands = (planned: ReturnType<typeof planChecks>) =>
  planned.checks.map((check) => [check.tool, check.command, check.scoped]);

describe("planChecks", () => {
  it("runs every command without {files} in kind order and skips {files} ones without files", () => {
    const planned = plan(TOOLS);
    expect(planned.checks).toEqual([
      {
        kind: "test",
        tool: "suite",
        command: "vitest run",
        scoped: false,
        timeout: DEFAULT_TIMEOUT,
      },
      { kind: "test", tool: "e2e", command: "playwright test", scoped: false, timeout: 900 },
      { kind: "build", tool: "tsc", command: "tsc -b", scoped: false, timeout: 120 },
    ]);
    expect(planned.skipped).toEqual([
      { kind: "test", tool: "unit", reason: "no-files" },
      { kind: "lint", tool: "eslint", reason: "no-files" },
    ]);
  });

  it("fills every {files} of a command and runs a command without one as written", () => {
    expect(commands(plan(TOOLS, { files: ["src/a b.ts", "src/c.ts"] }))).toEqual([
      ["unit", "vitest run 'src/a b.ts' src/c.ts", true],
      ["suite", "vitest run", false],
      ["e2e", "playwright test", false],
      ["eslint", "eslint 'src/a b.ts' src/c.ts && tsc --noEmit 'src/a b.ts' src/c.ts", true],
      ["tsc", "tsc -b", false],
    ]);
  });

  it("selects the entries of one point and those without when, leaving the rest unlisted", () => {
    const part = plan(TOOLS, { at: "part", files: ["src/a.ts"] });
    expect(commands(part).map(([tool]) => tool)).toEqual(["unit", "eslint", "tsc"]);
    expect(part.skipped).toEqual([]);
    const wave = plan(TOOLS, { at: "wave", files: ["src/a.ts"] });
    expect(commands(wave).map(([tool]) => tool)).toEqual(["suite", "eslint", "tsc"]);
    const review = plan(TOOLS, { at: "review" });
    expect(commands(review).map(([tool]) => tool)).toEqual(["suite", "e2e", "tsc"]);
    expect(review.skipped).toEqual([{ kind: "lint", tool: "eslint", reason: "no-files" }]);
  });

  it("puts a path holding $ patterns into the command literally", () => {
    const [unit] = plan(TOOLS, { kinds: ["test"], files: ["src/a$&.ts", "src/b$'.ts"] }).checks;
    expect(unit?.command).toBe("vitest run 'src/a$&.ts' 'src/b$'\\''.ts'");
  });

  it("keeps only the kinds asked for, still in kind order", () => {
    expect(
      plan(TOOLS, { kinds: ["build", "lint"], files: ["a"] }).checks.map((c) => c.kind),
    ).toEqual(["lint", "build"]);
  });

  it("plans nothing when no entry is configured", () => {
    expect(plan({ test: [], lint: [], build: [] })).toEqual({ checks: [], skipped: [] });
  });
});

// Two packages: a Python API and a React frontend (issue #275).
const MONOREPO: Tools = {
  test: [
    { id: "api", command: "uv run pytest {files}", paths: ["api/**"] },
    { id: "web", command: "pnpm vitest run {files}", paths: ["web/**"] },
  ],
  lint: [{ id: "ruff", command: "uv run ruff check .", paths: ["**/*.py"] }],
  build: [{ id: "tsc", command: "tsc -b" }],
};

describe("planChecks with paths", () => {
  it("gives each entry only the files its paths match and skips one with none", () => {
    const planned = plan(MONOREPO, { kinds: ["test"], files: ["web/src/a.tsx"] });
    expect(commands(planned)).toEqual([["web", "pnpm vitest run web/src/a.tsx", true]]);
    expect(planned.skipped).toEqual([{ kind: "test", tool: "api", reason: "paths" }]);
  });

  it("matches a path with a leading ./ and puts it into the command as given", () => {
    const files = scopeOf(["web/src/a.tsx", "api/app.py", "./api/tests/test_app.py"]);
    const planned = plan(MONOREPO, { kinds: ["test"], files });
    expect(commands(planned)).toEqual([
      ["api", "uv run pytest ./api/tests/test_app.py api/app.py", true],
      ["web", "pnpm vitest run web/src/a.tsx", true],
    ]);
    expect(planned.skipped).toEqual([]);
  });

  it("matches dot files and lets * stay inside one directory", () => {
    const tools: Tools = {
      test: [],
      lint: [
        { id: "top", command: "x {files}", paths: ["*.py"] },
        { id: "dot", command: "y {files}", paths: ["**/.env*"] },
      ],
      build: [],
    };
    const planned = plan(tools, { files: ["api/app.py", "web/.env.local"] });
    expect(commands(planned)).toEqual([["dot", "y web/.env.local", true]]);
    expect(planned.skipped).toEqual([{ kind: "lint", tool: "top", reason: "paths" }]);
  });

  it("runs a whole command with paths only when a file matches", () => {
    expect(commands(plan(MONOREPO, { kinds: ["lint"], files: ["api/app.py"] }))).toEqual([
      ["ruff", "uv run ruff check .", false],
    ]);
    expect(plan(MONOREPO, { kinds: ["lint"], files: ["web/src/a.tsx"] })).toEqual({
      checks: [],
      skipped: [{ kind: "lint", tool: "ruff", reason: "paths" }],
    });
  });

  it("skips every entry whose paths match no file, in run order", () => {
    expect(plan(MONOREPO, { kinds: ["test", "lint"], files: ["docs/README.md"] })).toEqual({
      checks: [],
      skipped: [
        { kind: "test", tool: "api", reason: "paths" },
        { kind: "test", tool: "web", reason: "paths" },
        { kind: "lint", tool: "ruff", reason: "paths" },
      ],
    });
  });

  it("runs a whole command with paths when the run has no files", () => {
    const planned = plan(MONOREPO);
    expect(commands(planned)).toEqual([
      ["ruff", "uv run ruff check .", false],
      ["tsc", "tsc -b", false],
    ]);
    expect(planned.skipped).toEqual([
      { kind: "test", tool: "api", reason: "no-files" },
      { kind: "test", tool: "web", reason: "no-files" },
    ]);
  });
});

describe("changed files", () => {
  it("reads NUL-separated git paths and drops empty ones", () => {
    expect(nulPaths("src/a.ts\0src/it's a.ts\0")).toEqual(["src/a.ts", "src/it's a.ts"]);
    expect(nulPaths("")).toEqual([]);
  });
});

describe("status and verdict", () => {
  it("maps an outcome to a status", () => {
    expect(statusOf({ kind: "exit", code: 0 })).toBe("pass");
    expect(statusOf({ kind: "exit", code: 127 })).toBe("fail");
    expect(statusOf({ kind: "timeout" })).toBe("timeout");
  });

  it("fails when any check is red, is none without checks, passes otherwise", () => {
    expect(verdictOf([])).toBe("none");
    expect(verdictOf(["pass", "pass"])).toBe("pass");
    expect(verdictOf(["pass", "timeout"])).toBe("fail");
    expect(verdictOf(["fail", "pass"])).toBe("fail");
  });
});

describe("output file", () => {
  it("ends the output with the exit or timeout line on a line of its own", () => {
    expect(trailer("ok\n", { kind: "exit", code: 0 }, 600)).toBe("exit 0\n");
    expect(trailer("no newline", { kind: "exit", code: 2 }, 600)).toBe("\nexit 2\n");
    expect(trailer("", { kind: "timeout" }, 5)).toBe("timeout 5\n");
  });

  it("keeps the last 20 lines of the output", () => {
    const text = Array.from({ length: 25 }, (_, i) => `line ${String(i + 1)}`).join("\n");
    const tail = tailOf(`${text}\n`);
    expect(tail).toHaveLength(20);
    expect(tail[0]).toBe("line 6");
    expect(tail.at(-1)).toBe("line 25");
    expect(tailOf("")).toEqual([]);
    expect(tailOf("a\r\nb")).toEqual(["a", "b"]);
  });
});

describe("finding", () => {
  it("names the kind, the tool and the exit code", () => {
    expect(
      finding(
        { kind: "lint", tool: "eslint", status: "fail", exit: 1, timeout: 600 },
        "/r/checks/02/lint-eslint.txt",
      ),
    ).toEqual({
      source: "check-run",
      rule: "check/lint/eslint",
      summary: "lint eslint failed with exit 1",
      evidence: "/r/checks/02/lint-eslint.txt",
    });
  });

  it("names the timeout", () => {
    expect(
      finding({ kind: "test", tool: "unit", status: "timeout", exit: null, timeout: 30 }, "o.txt")
        .summary,
    ).toBe("test unit timed out after 30 s");
  });
});
