import { describe, expect, it } from "vitest";

import {
  bashCap,
  bashTimeout,
  DEFAULT_TIMEOUT,
  isCompound,
  lineOf,
  notesOf,
  nulPaths,
  planChecks,
  quote,
  scopeOf,
} from "../domain/plan.ts";
import type { Kind, Point, Tools } from "../domain/plan.ts";
import {
  bodyOf,
  finding,
  hasTrailer,
  statusOf,
  tailOf,
  trailer,
  verdictOf,
} from "../domain/verdict.ts";

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

describe("picked tests", () => {
  const tools: Tools = {
    test: [
      { id: "unit", command: "vitest related --run {files}", paths: ["src/**"] },
      { id: "e2e", command: "npm run test:e2e -- {files}", paths: ["e2e/**/*.spec.ts"] },
    ],
    lint: [{ id: "eslint", command: "eslint {files}" }],
    build: [],
  };

  it("gives test entries the picked tests and every other entry the run's files", () => {
    const plan = planChecks(tools, {
      files: ["src/checkout.ts"],
      tests: ["e2e/checkout.spec.ts", "src/checkout.test.ts"],
    });
    expect(plan.checks.map((check) => check.command)).toEqual([
      "vitest related --run src/checkout.test.ts",
      "npm run test:e2e -- e2e/checkout.spec.ts",
      "eslint src/checkout.ts",
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it("skips a test entry none of the picked tests is for", () => {
    const plan = planChecks(tools, { files: ["src/checkout.ts"], tests: ["src/checkout.test.ts"] });
    expect(plan.skipped).toEqual([{ kind: "test", tool: "e2e", reason: "paths" }]);
  });

  it("gives test entries the run's files without picked tests", () => {
    const plan = planChecks(tools, { files: ["src/a.ts"], tests: null });
    expect(plan.checks[0]?.command).toBe("vitest related --run src/a.ts");
  });
});

describe("the line the agent runs", () => {
  it("closes stdin and sends both streams to the output file", () => {
    expect(lineOf("npm run test:e2e -- e2e/a.spec.ts", ".bdk/runs/x/checks/02/test-e2e.txt")).toBe(
      "npm run test:e2e -- e2e/a.spec.ts </dev/null > .bdk/runs/x/checks/02/test-e2e.txt 2>&1",
    );
    expect(lineOf("make", "/tmp/a b/out.txt")).toBe("make </dev/null > '/tmp/a b/out.txt' 2>&1");
  });

  it("caps the Bash timeout and reads the cap from BASH_MAX_TIMEOUT_MS", () => {
    expect(bashCap(undefined)).toBe(600_000);
    expect(bashCap("abc")).toBe(600_000);
    expect(bashCap("0")).toBe(600_000);
    expect(bashCap("1800000")).toBe(1_800_000);
    expect(bashTimeout(900, 600_000)).toBe(600_000);
    expect(bashTimeout(900, 1_800_000)).toBe(900_000);
    expect(bashTimeout(30, 600_000)).toBe(30_000);
  });

  it("finds a list or pipe outside quotes", () => {
    expect(isCompound("pnpm codegen && pnpm build")).toBe(true);
    expect(isCompound("a || b")).toBe(true);
    expect(isCompound("a; b")).toBe(true);
    expect(isCompound("a | tail")).toBe(true);
    expect(isCompound("vitest run 'a;b.ts' \"c|d\"")).toBe(false);
    expect(isCompound("echo a\\;b")).toBe(false);
    expect(isCompound("node smoke.js &")).toBe(false);
  });

  it("notes a timeout above the cap and a compound command", () => {
    expect(notesOf("vitest run", 900, 600_000)).toEqual([
      'its timeout of 900 s exceeds the Bash cap of 600 s; set env.BASH_MAX_TIMEOUT_MS to "900000" in .claude/settings.json',
    ]);
    expect(notesOf("a && b", 30, 600_000)).toHaveLength(1);
    expect(notesOf("vitest run", 600, 600_000)).toEqual([]);
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
    expect(statusOf({ kind: "none" })).toBe("not-run");
  });

  it("fails when any check is red, is none without checks, passes otherwise", () => {
    expect(verdictOf([])).toBe("none");
    expect(verdictOf(["pass", "pass"])).toBe("pass");
    expect(verdictOf(["pass", "timeout"])).toBe("fail");
    expect(verdictOf(["fail", "pass"])).toBe("fail");
    expect(verdictOf(["pass", "not-run"])).toBe("fail");
  });
});

describe("output file", () => {
  it("ends the output with the exit or timeout line on a line of its own", () => {
    expect(trailer("ok\n", { kind: "exit", code: 0 }, 600)).toBe("exit 0\n");
    expect(trailer("no newline", { kind: "exit", code: 2 }, 600)).toBe("\nexit 2\n");
    expect(trailer("", { kind: "timeout" }, 5)).toBe("timeout 5\n");
  });

  it("knows an output that already ends with an exit or timeout line, and drops it for the tail", () => {
    expect(hasTrailer("ok\nexit 0\n")).toBe(true);
    expect(hasTrailer("timeout 900\n")).toBe(true);
    expect(hasTrailer("ok\n")).toBe(false);
    expect(hasTrailer("exit code 1\n")).toBe(false);
    expect(hasTrailer("")).toBe(false);
    expect(bodyOf("ok\nexit 1\n")).toBe("ok\n");
    expect(bodyOf("exit 1\n")).toBe("");
    expect(bodyOf("ok\n")).toBe("ok\n");
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

  it("names a check nobody ran", () => {
    expect(
      finding({ kind: "test", tool: "unit", status: "not-run", exit: null, timeout: 30 }, "o.txt")
        .summary,
    ).toBe("test unit was not run");
  });
});
