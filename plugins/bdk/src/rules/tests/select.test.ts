import { describe, expect, it } from "vitest";

import type { Rule, Stage } from "../domain/rule.ts";
import { select } from "../domain/select.ts";
import type { Selected } from "../domain/select.ts";

// Selection by stage, path and language (spec `bdk-cli/rules`, "Rules for a stage and files").

function rule(id: string, fields: Partial<Rule> = {}): Rule {
  return {
    id,
    origin: id.startsWith("BDK-") ? "bdk" : "project",
    language: null,
    file: `rules/${id}.md`,
    kind: "house",
    paths: ["**"],
    stages: ["plan", "execute", "review"],
    source: null,
    verified: null,
    measured: null,
    text: `${id} text`,
    ...fields,
  };
}

const TS = ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx"];
const REACT = ["**/*.jsx", "**/*.tsx"];

const RULES: readonly Rule[] = [
  rule("BDK-ARCH-3", { stages: ["design", "plan", "execute", "review"] }),
  rule("BDK-CQ-1"),
  rule("BDK-CQ-4"),
  rule("BDK-TS-7", { language: "typescript", paths: TS }),
  rule("BDK-REACT-10", { language: "react", paths: REACT }),
  rule("BDK-REACT-2", { language: "react", paths: REACT }),
  rule("API-1", { paths: ["src/api/**"], stages: ["review"] }),
];

function ids(selection: readonly Selected[]): string[] {
  return selection.map((selected) => selected.id);
}

function run(
  stage: Stage,
  files: readonly string[],
  options: { languages?: readonly string[] } = {},
): Selected[] {
  return select({
    rules: RULES,
    stage,
    files,
    languages: options.languages ?? ["typescript", "react"],
  });
}

describe("selection", () => {
  it("selects by stage", () => {
    expect(ids(run("design", [], { languages: [] }))).toEqual(["BDK-ARCH-3"]);
  });

  it("selects by path, and drops the path condition without files", () => {
    expect(ids(run("review", ["src/util.ts"]))).toEqual([
      "BDK-ARCH-3",
      "BDK-CQ-1",
      "BDK-CQ-4",
      "BDK-TS-7",
    ]);
    expect(ids(run("review", []))).toEqual([
      "BDK-ARCH-3",
      "BDK-CQ-1",
      "BDK-CQ-4",
      "BDK-REACT-2",
      "BDK-REACT-10",
      "BDK-TS-7",
      "API-1",
    ]);
  });

  it("selects by language", () => {
    expect(ids(run("review", ["src/App.tsx"], { languages: ["typescript"] }))).toEqual([
      "BDK-ARCH-3",
      "BDK-CQ-1",
      "BDK-CQ-4",
      "BDK-TS-7",
    ]);
  });

  it("matches globs: * within a segment, ** across directories, dot files alike", () => {
    expect(ids(run("review", ["src/api/v1/users.ts"]))).toContain("API-1");
    expect(ids(run("review", ["src/apiary.ts"]))).not.toContain("API-1");
    expect(ids(run("review", [".github/check.ts"]))).toContain("BDK-TS-7");
    const flat = select({
      rules: [rule("X-1", { paths: ["src/*.ts"] })],
      stage: "review",
      files: ["src/a/b.ts"],
      languages: [],
    });
    expect(ids(flat)).toEqual([]);
  });

  it("records the files each rule matched, and orders by origin, ids by number", () => {
    const selection = run("review", ["src/App.tsx", "README.md", "src/api/x.ts"]);
    expect(ids(selection)).toEqual([
      "BDK-ARCH-3",
      "BDK-CQ-1",
      "BDK-CQ-4",
      "BDK-REACT-2",
      "BDK-REACT-10",
      "BDK-TS-7",
      "API-1",
    ]);
    const matched = Object.fromEntries(selection.map((r) => [r.id, r.matched]));
    expect(matched["BDK-CQ-1"]).toEqual(["src/App.tsx", "README.md", "src/api/x.ts"]);
    expect(matched["BDK-REACT-2"]).toEqual(["src/App.tsx"]);
    expect(matched["BDK-TS-7"]).toEqual(["src/App.tsx", "src/api/x.ts"]);
    expect(matched["API-1"]).toEqual(["src/api/x.ts"]);
  });

  it("orders the origins bdk, global, project, local", () => {
    const rules = [
      rule("L-1", { origin: "local" }),
      rule("P-1", { origin: "project" }),
      rule("G-1", { origin: "global" }),
      rule("BDK-CQ-1"),
    ];
    const selection = select({ rules, stage: "review", files: [], languages: [] });
    expect(ids(selection)).toEqual(["BDK-CQ-1", "G-1", "P-1", "L-1"]);
  });
});
