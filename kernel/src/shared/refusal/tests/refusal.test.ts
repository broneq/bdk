import { describe, expect, it } from "vitest";

import { exitCodeFor, KernelRefusal, refuse, RULES, ruleClass } from "../index.ts";
import type { Rule } from "../index.ts";

describe("exitCodeFor", () => {
  it.each([
    ["policy/no-active-change", 2],
    ["guard/subagent-git", 2],
    ["kernel/not-implemented", 2],
    ["input/unknown-flag", 3],
    ["state/corrupted-index", 4],
    ["runtime/node-version", 5],
  ] as const)("maps %s to exit %i", (rule, code) => {
    expect(exitCodeFor(rule)).toBe(code);
  });

  it("maps every catalogued rule to 2, 3, 4 or 5", () => {
    for (const rule of RULES) expect([2, 3, 4, 5]).toContain(exitCodeFor(rule));
  });
});

describe("ruleClass", () => {
  it("is the part before the slash", () => {
    expect(ruleClass("runtime/not-a-repo")).toBe("runtime");
  });
});

describe("refuse", () => {
  it("yields exactly the four fields", () => {
    const refusal = refuse("input/unknown-flag", "flag --x is not declared by bdk version", [
      "bdk version --help",
    ]);
    expect(refusal).toStrictEqual({
      refused: true,
      rule: "input/unknown-flag",
      why: "flag --x is not declared by bdk version",
      instead: ["bdk version --help"],
    });
  });

  it("rejects an empty why or an empty instead", () => {
    expect(() => refuse("input/unknown-flag", "", ["bdk --help"])).toThrow();
    expect(() => refuse("input/unknown-flag", "x", [])).toThrow();
  });

  it("rejects an unknown rule at type level", () => {
    // @ts-expect-error - not in the catalogue
    const rule: Rule = "input/made-up";
    expect(RULES).not.toContain(rule);
  });
});

describe("KernelRefusal", () => {
  it("carries the refusal through a throw", () => {
    const refusal = refuse("runtime/git-missing", "no git executable on PATH", ["install git"]);
    const error = new KernelRefusal(refusal);
    expect(error).toBeInstanceOf(Error);
    expect(error.refusal).toBe(refusal);
    expect(error.message).toBe("runtime/git-missing: no git executable on PATH");
  });
});
