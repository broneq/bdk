import { describe, expect, it } from "vitest";

import { DEFAULT_TIMEOUT, planChecks, quote, scopeOf } from "../domain/plan.ts";
import type { Tools } from "../domain/plan.ts";
import { finding, statusOf, tailOf, trailer, verdictOf } from "../domain/verdict.ts";

// Pure rules of spec `bdk-cli/check`, "Run the checks", "Output files", "Red checks as findings".

const TOOLS: Tools = {
  test: [
    { id: "unit", command: "vitest run", scoped: "vitest run {files}" },
    { id: "e2e", command: "playwright test", timeout: 900 },
  ],
  lint: [{ id: "eslint", command: "eslint .", scoped: "eslint {files} && tsc --noEmit {files}" }],
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

describe("planChecks", () => {
  it("runs every full command in kind order test, lint, build without a scope", () => {
    expect(planChecks(TOOLS, undefined, null)).toEqual([
      {
        kind: "test",
        tool: "unit",
        command: "vitest run",
        scoped: false,
        timeout: DEFAULT_TIMEOUT,
      },
      { kind: "test", tool: "e2e", command: "playwright test", scoped: false, timeout: 900 },
      { kind: "lint", tool: "eslint", command: "eslint .", scoped: false, timeout: 600 },
      { kind: "build", tool: "tsc", command: "tsc -b", scoped: false, timeout: 120 },
    ]);
  });

  it("fills every {files} of a scoped variant and runs the full command of an entry without one", () => {
    const planned = planChecks(TOOLS, undefined, ["src/a b.ts", "src/c.ts"]);
    expect(planned.map((check) => [check.command, check.scoped])).toEqual([
      ["vitest run 'src/a b.ts' src/c.ts", true],
      ["playwright test", false],
      ["eslint 'src/a b.ts' src/c.ts && tsc --noEmit 'src/a b.ts' src/c.ts", true],
      ["tsc -b", false],
    ]);
  });

  it("puts a path holding $ patterns into the command literally", () => {
    const [unit] = planChecks(TOOLS, ["test"], ["src/a$&.ts", "src/b$'.ts"]);
    expect(unit?.command).toBe("vitest run 'src/a$&.ts' 'src/b$'\\''.ts'");
  });

  it("keeps only the kinds asked for, still in kind order", () => {
    expect(planChecks(TOOLS, ["build", "lint"], null).map((check) => check.kind)).toEqual([
      "lint",
      "build",
    ]);
  });

  it("plans nothing when no entry is configured", () => {
    expect(planChecks({ test: [], lint: [], build: [] }, undefined, null)).toEqual([]);
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
