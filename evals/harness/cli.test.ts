import { describe, expect, it } from "vitest";

import { SUITES, UsageError, credentialsProblem, parseArgs, run } from "./cli.ts";
import type { CliDeps, SuiteRunner } from "./cli.ts";

function deps(
  overrides: Partial<CliDeps> = {},
): CliDeps & { out: string[]; err: string[]; calls: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  const calls: string[] = [];
  const suite = (name: string): SuiteRunner => ({
    run: (options) => {
      calls.push(`${name}:run:${options.probe ? "probe" : "series"}`);
      return Promise.resolve(0);
    },
    check: () => {
      calls.push(`${name}:check`);
      return Promise.resolve();
    },
    report: () => {
      calls.push(`${name}:report`);
      return Promise.resolve();
    },
  });
  return {
    env: { ANTHROPIC_API_KEY: "sk-test" },
    authStatus: () => ({ loggedIn: false }),
    suites: Object.fromEntries(SUITES.map((name) => [name, suite(name)])) as CliDeps["suites"],
    print: (line) => out.push(line),
    printError: (line) => err.push(line),
    ...overrides,
    out,
    err,
    calls,
  };
}

describe("parseArgs", () => {
  it("parses a suite run with its flags", () => {
    expect(
      parseArgs(["execute-ab", "--probe", "--runs", "3", "--budget", "40", "--run-cap", "8"]),
    ).toEqual({
      command: "run",
      suite: "execute-ab",
      probe: true,
      runs: 3,
      budget: 40,
      runCap: 8,
    });
  });

  it("parses a patch filter for the rules-noop suite", () => {
    expect(parseArgs(["rules-noop", "--patches", "22-a,23-b"])).toMatchObject({
      patches: ["22-a", "23-b"],
    });
    expect(() => parseArgs(["rules-noop", "--patches"])).toThrow(UsageError);
    expect(() => parseArgs(["rules-noop", "--patches", ","])).toThrow(UsageError);
    expect(() => parseArgs(["execute-ab", "--patches", "22-a"])).toThrow(UsageError);
  });

  it("defaults to 5 runs, 100 USD and a 15 USD run cap", () => {
    expect(parseArgs(["rules-noop"])).toMatchObject({
      runs: 5,
      budget: 100,
      runCap: 15,
      probe: false,
    });
  });

  it("parses the with / without flags", () => {
    expect(
      parseArgs([
        "with-without",
        "--skill",
        "bdk-craft:tdd",
        "--tasks",
        "t.yaml",
        "--fixture",
        "none",
      ]),
    ).toMatchObject({
      suite: "with-without",
      skill: "bdk-craft:tdd",
      tasks: "t.yaml",
      fixture: "none",
    });
  });

  it("requires --skill and --tasks for with-without", () => {
    expect(() => parseArgs(["with-without", "--skill", "bdk:x"])).toThrow(/--tasks/);
  });

  it("takes --case for stages only", () => {
    expect(parseArgs(["stages", "--skill", "run", "--case", "run-auto,run-close"])).toMatchObject({
      cases: ["run-auto", "run-close"],
    });
    expect(() => parseArgs(["stages", "--skill", "run", "--case", ""])).toThrow(/--case needs/);
    expect(() => parseArgs(["rules-noop", "--case", "x"])).toThrow(/stages only/);
  });

  it("requires --skill for stages", () => {
    expect(() => parseArgs(["stages", "--probe"])).toThrow(/stages needs --skill/);
    expect(parseArgs(["stages", "--skill", "setup", "--probe"])).toMatchObject({
      suite: "stages",
      skill: "setup",
      probe: true,
    });
  });

  it("parses check and report", () => {
    expect(parseArgs(["check"])).toEqual({ command: "check" });
    expect(parseArgs(["report", "execute-ab"])).toEqual({ command: "report", suite: "execute-ab" });
  });

  it("refuses an unknown suite, listing the known ones", () => {
    const error = (() => {
      try {
        parseArgs(["nosuch"]);
      } catch (caught) {
        return caught as Error;
      }
      throw new Error("no error");
    })();
    expect(error).toBeInstanceOf(UsageError);
    for (const suite of SUITES) expect(error.message).toContain(suite);
  });

  it("refuses an unknown flag and a non-numeric value", () => {
    expect(() => parseArgs(["execute-ab", "--fast"])).toThrow(/--fast/);
    expect(() => parseArgs(["execute-ab", "--runs", "many"])).toThrow(/--runs/);
    expect(() => parseArgs(["execute-ab", "--runs", "1"])).toThrow(/at least 2/);
  });
});

describe("credentialsProblem", () => {
  it("accepts an API key or a Claude Code login", () => {
    expect(credentialsProblem({ ANTHROPIC_API_KEY: "k" }, () => ({ loggedIn: false }))).toBeNull();
    expect(credentialsProblem({}, () => ({ loggedIn: true }))).toBeNull();
  });

  it("names both ways when neither is there", () => {
    const problem = credentialsProblem({}, () => ({ loggedIn: false }));
    expect(problem).toMatch(/ANTHROPIC_API_KEY/);
    expect(problem).toMatch(/claude auth login/);
    expect(credentialsProblem({}, () => undefined)).toMatch(/ANTHROPIC_API_KEY/);
  });
});

describe("run", () => {
  it("runs the suite and returns its exit code", async () => {
    const d = deps();
    expect(await run(["execute-ab", "--probe"], d)).toBe(0);
    expect(d.calls).toEqual(["execute-ab:run:probe"]);
  });

  it("reports a usage error the suite raises, such as an unknown patch", async () => {
    const d = deps();
    const failing: SuiteRunner = {
      ...d.suites["rules-noop"],
      run: () => Promise.reject(new UsageError("unknown patch 99-missing")),
    };
    const withFailing = { ...d, suites: { ...d.suites, "rules-noop": failing } };
    expect(await run(["rules-noop", "--patches", "99-missing"], withFailing)).toBe(2);
    expect(d.err.join("\n")).toMatch(/unknown patch 99-missing/);
  });

  it("exits non-zero without credentials before the suite starts", async () => {
    const d = deps({ env: {}, authStatus: () => ({ loggedIn: false }) });
    expect(await run(["execute-ab"], d)).toBe(1);
    expect(d.calls).toEqual([]);
    expect(d.err.join("\n")).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("checks every suite without credentials", async () => {
    const d = deps({ env: {}, authStatus: () => undefined });
    expect(await run(["check"], d)).toBe(0);
    expect(d.calls).toEqual(SUITES.map((suite) => `${suite}:check`));
  });

  it("prints usage and exits 2 on a usage error", async () => {
    const d = deps();
    expect(await run(["nosuch"], d)).toBe(2);
    expect(d.err.join("\n")).toMatch(/usage: pnpm eval/);
  });
});
