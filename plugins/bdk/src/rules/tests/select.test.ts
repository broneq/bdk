import { describe, expect, it } from "vitest";

import { closest } from "../../shared/cli/index.ts";
import type { Rule, Stage } from "../domain/rule.ts";
import { select } from "../domain/select.ts";
import type { Selection } from "../domain/select.ts";

// Selection by stage, path and language (spec `bdk-cli/rules`, "Rules for a stage and files";
// spec `rule-pack`, "Switching rules off").

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

function ids(selection: Selection): string[] {
  return selection.rules.map((selected) => selected.id);
}

function run(
  stage: Stage,
  files: readonly string[],
  options: { languages?: readonly string[]; disabled?: readonly string[] } = {},
): Selection {
  return select({
    rules: RULES,
    stage,
    files,
    languages: options.languages ?? ["typescript", "react"],
    disabled: options.disabled ?? [],
    closest,
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
      disabled: [],
      closest,
    });
    expect(ids(flat)).toEqual([]);
  });

  it("records the files each rule matched, and orders bdk before project, ids by number", () => {
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
    const matched = Object.fromEntries(selection.rules.map((r) => [r.id, r.matched]));
    expect(matched["BDK-CQ-1"]).toEqual(["src/App.tsx", "README.md", "src/api/x.ts"]);
    expect(matched["BDK-REACT-2"]).toEqual(["src/App.tsx"]);
    expect(matched["BDK-TS-7"]).toEqual(["src/App.tsx", "src/api/x.ts"]);
    expect(matched["API-1"]).toEqual(["src/api/x.ts"]);
    expect(selection.warnings).toEqual([]);
  });

  it("drops disabled rules of either origin", () => {
    expect(ids(run("review", ["src/api/x.ts"], { disabled: ["BDK-CQ-4", "API-1"] }))).toEqual([
      "BDK-ARCH-3",
      "BDK-CQ-1",
      "BDK-TS-7",
    ]);
  });

  it("warns about a disabled id that names no rule, with the closest id", () => {
    const selection = run("review", [], { disabled: ["BDK-CQ-44", "nothing-like-it"] });
    expect(selection.warnings).toEqual([
      "rules.disabled names no rule BDK-CQ-44; did you mean BDK-CQ-4?",
      "rules.disabled names no rule nothing-like-it",
    ]);
  });

  it("warns about a configured language without rules", () => {
    expect(run("review", [], { languages: ["cobol", "react"] }).warnings).toEqual([
      "no rules for language cobol",
    ]);
  });
});
