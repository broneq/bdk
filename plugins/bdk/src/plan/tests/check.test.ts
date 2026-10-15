import { describe, expect, it } from "vitest";

import { CHECKS, PRESENT_ENDING, PROBLEMS, checkPlan } from "../domain/check.ts";
import type { Limits } from "../domain/check.ts";
import type { Part } from "../domain/part.ts";

// The plan checks of spec `bdk-cli/plan`: limits, present scenarios, dependencies and waves.

const LIMITS: Limits = { maxTasks: 5, maxFiles: 10, maxBytes: 8192 };

function part(id: string, over: Partial<Part> = {}): Part {
  return {
    id,
    dependsOn: [],
    files: [`src/${id}.ts`],
    tasks: 2,
    bytes: 1000,
    scenarios: [],
    verifiedBy: [],
    faults: [],
    ...over,
  };
}

const waves = (parts: readonly Part[]) =>
  checkPlan(parts, [], LIMITS).waves.map((wave) => `${String(wave.wave)}: ${wave.parts.join(" ")}`);

describe("checkPlan limits", () => {
  it("passes a value equal to its limit and reports one above it", () => {
    const files = Array.from({ length: 11 }, (_, i) => `src/f${String(i)}.ts`);
    const { problems } = checkPlan(
      [
        part("01", { tasks: 5, files: files.slice(0, 10), bytes: 8192 }),
        part("02", { tasks: 6, files, bytes: 9216, dependsOn: ["01"] }),
      ],
      [],
      LIMITS,
    );
    expect(problems).toEqual([
      { check: "max-tasks", parts: ["02"], message: "6 tasks, above plan.part.max-tasks 5" },
      { check: "max-files", parts: ["02"], message: "11 files, above plan.part.max-files 10" },
      {
        check: "max-bytes",
        parts: ["02"],
        message: "9216 bytes, above plan.part.max-bytes 8192",
      },
    ]);
  });

  it("applies the given limits", () => {
    const { problems } = checkPlan([part("01", { tasks: 6 })], [], { ...LIMITS, maxTasks: 7 });
    expect(problems).toEqual([]);
  });

  it("reports a part without tasks, an empty directory and stray files", () => {
    expect(checkPlan([part("01", { tasks: 0 })], [], LIMITS).problems).toEqual([
      { check: "no-tasks", parts: ["01"], message: "has no numbered task under ## Tasks" },
    ]);
    expect(checkPlan([], ["02-login.md"], LIMITS)).toEqual({
      parts: [],
      waves: [],
      problems: [
        { check: "no-parts", parts: [], message: "the directory holds no part file NN.md" },
        { check: "name", parts: [], message: "02-login.md is not a part file; a part is NN.md" },
      ],
    });
  });
});

describe("checkPlan present scenarios", () => {
  const scenarios = [
    { name: "Empty ledger", present: true },
    { name: "Broken ledger", present: true },
    { name: "Total", present: false },
    { name: "Count flag", present: false },
  ];
  const problems = (verifiedBy: string[]) =>
    checkPlan([part("01", { scenarios, verifiedBy })], [], LIMITS).problems;

  it("passes a plan whose present scenarios each have a line with the ending", () => {
    expect(
      problems([
        "Scenario: Total, Scenario: Count flag; src/total.test.js",
        `Scenario: Empty ledger; no ledger.json prints \`Total: 0.00\`${PRESENT_ENDING}`,
        `Scenario: Broken ledger; \`{\` exits 2${PRESENT_ENDING}`,
      ]),
    ).toEqual([]);
  });

  it("reports a present scenario named only on a line without the ending, or in its middle", () => {
    expect(
      problems([
        "Scenario: Count flag, Scenario: Empty ledger; src/total.test.js",
        `Scenario: Broken ledger (it passes at its first run, the behaviour is present); src/total.test.js`,
        `Scenario: Total; src/total.test.js`,
      ]),
    ).toEqual([
      {
        check: "present-scenario",
        parts: ["01"],
        message: `scenario "Broken ledger" is marked (behaviour present), but no Verified by: line names it and ends "${PRESENT_ENDING}"`,
      },
      {
        check: "present-scenario",
        parts: ["01"],
        message: `scenario "Empty ledger" is marked (behaviour present), but no Verified by: line names it and ends "${PRESENT_ENDING}"`,
      },
    ]);
  });

  it("reports an unmarked scenario the line names, by whole names, not in its test", () => {
    const own = part("01", {
      scenarios: [
        { name: "Total of an empty ledger", present: true },
        { name: "Total", present: false },
        { name: "Count flag", present: false },
      ],
      verifiedBy: [
        `Scenario: Total of an empty ledger and Count flag; prints \`Total: 0.00\`, Totals${PRESENT_ENDING}`,
      ],
    });
    expect(checkPlan([own], [], LIMITS).problems).toEqual([
      {
        check: "present-scenario",
        parts: ["01"],
        message: `a Verified by: line that ends "${PRESENT_ENDING}" names "Count flag", which is not marked (behaviour present)`,
      },
    ]);
  });

  it("leaves a part without present scenarios alone, and keeps its wave", () => {
    const own = part("01", { scenarios: [{ name: "Total", present: false }], verifiedBy: [] });
    expect(checkPlan([own], [], LIMITS).problems).toEqual([]);
    const marked = part("01", { scenarios: [{ name: "Total", present: true }] });
    expect(checkPlan([marked], [], LIMITS).waves).toEqual([{ wave: 1, parts: ["01"] }]);
  });
});

describe("checkPlan waves", () => {
  it("layers parts by depends-on, in order", () => {
    expect(
      waves([
        part("04", { dependsOn: ["02", "03"] }),
        part("02", { dependsOn: ["01"] }),
        part("03", { dependsOn: ["01"] }),
        part("01"),
      ]),
    ).toEqual(["1: 01", "2: 02 03", "3: 04"]);
  });

  it("puts a part after the latest of its dependencies", () => {
    expect(
      waves([
        part("01"),
        part("02", { dependsOn: ["01"] }),
        part("03", { dependsOn: ["01", "02"] }),
      ]),
    ).toEqual(["1: 01", "2: 02", "3: 03"]);
  });

  it("reports a cycle once and leaves its parts and their dependents without a wave", () => {
    const result = checkPlan(
      [
        part("01"),
        part("02", { dependsOn: ["03"] }),
        part("03", { dependsOn: ["02"] }),
        part("04", { dependsOn: ["03"] }),
      ],
      [],
      LIMITS,
    );
    expect(result.problems).toEqual([
      {
        check: "cycle",
        parts: ["02", "03"],
        message: "parts 02 and 03 depend on each other in a cycle",
      },
    ]);
    expect(result.parts.map((p) => [p.id, p.wave])).toEqual([
      ["01", 1],
      ["02", null],
      ["03", null],
      ["04", null],
    ]);
    expect(result.waves).toEqual([{ wave: 1, parts: ["01"] }]);
  });

  it("finds a longer cycle and a self-loop", () => {
    const { problems } = checkPlan(
      [
        part("01", { dependsOn: ["03"] }),
        part("02", { dependsOn: ["01"] }),
        part("03", { dependsOn: ["02"] }),
        part("04", { dependsOn: ["04"] }),
      ],
      [],
      LIMITS,
    );
    expect(problems.map((p) => [p.parts, p.message])).toEqual([
      [["01", "02", "03"], "parts 01, 02 and 03 depend on each other in a cycle"],
      [["04"], "part 04 depends on itself"],
    ]);
  });

  it("reports an unknown dependency and blocks the part and its dependents", () => {
    const result = checkPlan(
      [part("01"), part("02", { dependsOn: ["09"] }), part("03", { dependsOn: ["02"] })],
      [],
      LIMITS,
    );
    expect(result.problems).toEqual([
      {
        check: "unknown-dependency",
        parts: ["02"],
        message: "depends-on names 09, which is no part",
      },
    ]);
    expect(result.parts.map((p) => p.wave)).toEqual([1, null, null]);
  });

  it("gives a part with a frontmatter fault no wave", () => {
    const result = checkPlan([part("01", { faults: ["files is empty"] })], [], LIMITS);
    expect(result.problems).toEqual([
      { check: "frontmatter", parts: ["01"], message: "files is empty" },
    ]);
    expect(result.waves).toEqual([]);
  });
});

describe("checkPlan within a wave", () => {
  it("accepts parts of one wave that list the same file", () => {
    const { problems } = checkPlan(
      [
        part("01", { files: ["src/a.ts"] }),
        part("02", { dependsOn: ["01"], files: ["src/api/routes.ts", "src/a.ts"] }),
        part("03", { dependsOn: ["01"], files: ["src/api/routes.ts"] }),
      ],
      [],
      LIMITS,
    );
    expect(problems).toEqual([]);
  });

  it("orders problems by check, then part, then message", () => {
    const { problems } = checkPlan(
      [
        part("02", { tasks: 0, dependsOn: ["01"], files: ["x"] }),
        part("01", { tasks: 9 }),
        part("03", { dependsOn: ["03"], files: ["x"] }),
      ],
      ["a.md"],
      LIMITS,
    );
    expect(problems.map((p) => `${p.check} ${p.parts.join(",")}`)).toEqual([
      "name ",
      "no-tasks 02",
      "max-tasks 01",
      "cycle 03",
    ]);
  });
});

describe("PROBLEMS", () => {
  it("explains every check, in the order of CHECKS", () => {
    expect(Object.keys(PROBLEMS)).toEqual([...CHECKS]);
    for (const check of CHECKS) {
      expect(PROBLEMS[check].meaning, check).toMatch(/\S/);
      expect(PROBLEMS[check].fix, check).toMatch(/\S/);
    }
  });
});
