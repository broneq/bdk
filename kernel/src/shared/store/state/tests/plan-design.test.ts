import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { KernelRefusal } from "../../../refusal/index.ts";
import { splitFrontmatter } from "../../frontmatter.ts";
import { designIndexKind, designKind, designPartKind } from "../design.ts";
import { generateDesignIndex, generatePlanIndex } from "../indexes.ts";
import { planIndexKind, planPartKind } from "../plan.ts";
import * as example from "./examples.ts";
import { issues, without } from "./issues.ts";

function part(id: string, dependsOn: readonly string[], title = `Part ${id}`) {
  return { ...example.planPart, id, title, "depends-on": [...dependsOn] };
}

function refusalOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof KernelRefusal) return `${error.refusal.rule}: ${error.refusal.why}`;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("plan part", () => {
  const schema = planPartKind.schema;

  it("accepts the example and spec-impact none", () => {
    expect(issues(schema, example.planPart)).toStrictEqual([]);
    expect(issues(schema, { ...example.planPart, "spec-impact": "none" })).toStrictEqual([]);
  });

  it.each(Object.keys(example.planPart))("requires %s", (key) => {
    expect(issues(schema, without(example.planPart, key))).toStrictEqual([key]);
  });

  it.each([
    ["id", "2"],
    ["id", 2],
    ["depends-on", "01"],
    ["spec-impact", "auth-login"],
    ["success-measure", ""],
  ])("rejects %s: %j", (key, value) => {
    expect(issues(schema, { ...example.planPart, [key]: value })).toStrictEqual([key]);
  });
});

describe("design documents", () => {
  it("accepts the examples", () => {
    expect(issues(designKind.schema, example.design)).toStrictEqual([]);
    expect(issues(designPartKind.schema, example.designPart)).toStrictEqual([]);
  });

  it("requires schema and title on design.md", () => {
    expect(issues(designKind.schema, without(example.design, "schema"))).toStrictEqual(["schema"]);
    expect(issues(designKind.schema, without(example.design, "title"))).toStrictEqual(["title"]);
  });

  it.each(Object.keys(example.designPart))("requires %s on a design part", (key) => {
    expect(issues(designPartKind.schema, without(example.designPart, key))).toStrictEqual([key]);
  });
});

describe("generatePlanIndex", () => {
  const parts = [part("01", []), part("02", ["01"]), part("03", ["01"]), part("04", ["02", "03"])];

  it("computes waves from depends-on", () => {
    const { data } = splitAndParse(generatePlanIndex(parts));
    expect(data).toStrictEqual({
      schema: 1,
      generated: true,
      parts: [
        { id: "01", title: "Part 01", "depends-on": [], wave: 1 },
        { id: "02", title: "Part 02", "depends-on": ["01"], wave: 2 },
        { id: "03", title: "Part 03", "depends-on": ["01"], wave: 2 },
        { id: "04", title: "Part 04", "depends-on": ["02", "03"], wave: 3 },
      ],
    });
    expect(issues(planIndexKind.schema, data)).toStrictEqual([]);
  });

  it("renders the table body", () => {
    const text = generatePlanIndex([part("01", [], "Token store"), part("02", ["01"], "A | B")]);
    expect(splitFrontmatter(text).body).toBe(
      [
        "| Part | Title | Depends on | Wave |",
        "| ---- | ----- | ---------- | ---- |",
        "| 01 | Token store | - | 1 |",
        "| 02 | A \\| B | 01 | 2 |",
        "",
      ].join("\n"),
    );
  });

  it("yields the same bytes whatever the order of the parts", () => {
    expect(generatePlanIndex([...parts].reverse())).toBe(generatePlanIndex(parts));
  });

  it("names both parts of a cycle", () => {
    expect(refusalOf(() => generatePlanIndex([part("01", ["02"]), part("02", ["01"])]))).toBe(
      "policy/validation-failed: plan parts 01, 02 form a dependency cycle",
    );
  });

  it("names a missing dependency", () => {
    expect(refusalOf(() => generatePlanIndex([part("01", []), part("02", ["07"])]))).toBe(
      "policy/validation-failed: plan part 02 depends on 07, which does not exist",
    );
  });

  it("names a duplicate part id", () => {
    expect(refusalOf(() => generatePlanIndex([part("01", []), part("01", [])]))).toBe(
      "policy/validation-failed: plan part id 01 appears twice",
    );
  });
});

describe("generateDesignIndex", () => {
  it("lists the parts without waves", () => {
    const text = generateDesignIndex([
      { ...example.designPart, id: "02", title: "Mail", "depends-on": ["01"] },
      example.designPart,
    ]);
    const { data, body } = splitAndParse(text);
    expect(data).toStrictEqual({
      schema: 1,
      generated: true,
      parts: [
        { id: "01", title: "Auth service", "depends-on": [] },
        { id: "02", title: "Mail", "depends-on": ["01"] },
      ],
    });
    expect(issues(designIndexKind.schema, data)).toStrictEqual([]);
    expect(body).toBe(
      [
        "| Part | Title | Depends on |",
        "| ---- | ----- | ---------- |",
        "| 01 | Auth service | - |",
        "| 02 | Mail | 01 |",
        "",
      ].join("\n"),
    );
  });

  it("names a cycle", () => {
    const loop = { ...example.designPart, "depends-on": ["01"] };
    expect(refusalOf(() => generateDesignIndex([loop]))).toBe(
      "policy/validation-failed: design parts 01 form a dependency cycle",
    );
  });
});

function splitAndParse(text: string): { data: unknown; body: string } {
  const { frontmatter = "", body } = splitFrontmatter(text);
  return { data: parse(frontmatter), body };
}
