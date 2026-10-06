// Rule selection (`kernel-cli/rules`, bdk rules show, Selection; Stage
// readers): a rule's `stages` against the reader's stage, its `paths` against
// the file set, the language gate, order and no cap.
import { describe, expect, it } from "vitest";

import { RULE_STAGES } from "../../shared/vocabulary/index.ts";
import type { LoadedRule } from "../domain/rule.ts";
import { prefixOf } from "../domain/rule.ts";
import { selectRules } from "../use-cases/selection.ts";
import type { SelectionInput } from "../use-cases/selection.ts";

function rule(id: string, extra: Partial<LoadedRule> = {}): LoadedRule {
  const bundled = id.startsWith("BDK-");
  return {
    id,
    prefix: prefixOf(id),
    number: Number(id.slice(id.lastIndexOf("-") + 1)),
    scope: bundled ? "bundle" : "project",
    file: bundled ? `rules/x/${id}.md` : `.bdk/rules/${id}.md`,
    kind: "house",
    severity: "medium",
    paths: ["**"],
    stages: RULE_STAGES,
    origin: bundled ? "bdk" : "user",
    since: "2026-09-30",
    text: `Text of ${id}.`,
    ...extra,
  };
}

const PACK = [
  rule("BDK-CQ-1", { stages: ["plan", "execute", "review"] }),
  rule("BDK-DP-1", { stages: ["execute", "review"] }),
  rule("BDK-EJ-1", { stages: ["design", "plan"] }),
  rule("BDK-PL-1", { stages: ["plan"] }),
  rule("BDK-TS-1", { pack: "languages/typescript", paths: ["**/*.ts", "**/*.tsx"] }),
  rule("BDK-REACT-1", { pack: "languages/react", paths: ["**/*.jsx", "**/*.tsx"] }),
];

function ids(input: Partial<SelectionInput>): string[] {
  return selectRules({
    rules: PACK,
    stage: "execute",
    files: ["src/a.py"],
    languages: [],
    disabled: [],
    ...input,
  }).selected.map((entry) => entry.rule.id);
}

describe("selectRules", () => {
  it("selects a rule only for a stage it names", () => {
    expect(ids({ stage: "design" })).toStrictEqual(["BDK-EJ-1"]);
    expect(ids({ stage: "plan" })).toStrictEqual(["BDK-CQ-1", "BDK-EJ-1", "BDK-PL-1"]);
    expect(ids({ stage: "execute" })).toStrictEqual(["BDK-CQ-1", "BDK-DP-1"]);
    expect(ids({ stage: "review" })).toStrictEqual(["BDK-CQ-1", "BDK-DP-1"]);
  });

  it("selects nothing for a reader without a stage", () => {
    expect(ids({ rules: [...PACK, rule("API-1")], stage: undefined })).toStrictEqual([]);
  });

  it("stages and paths select a project rule", () => {
    const rules = [
      rule("E2E-1", { paths: ["tests/e2e/**"], stages: ["plan", "execute", "review"] }),
    ];
    const e2e = ["tests/e2e/login.spec.ts"];
    for (const stage of ["plan", "execute", "review"] as const) {
      expect(ids({ rules, stage, files: e2e })).toStrictEqual(["E2E-1"]);
    }
    expect(ids({ rules, stage: "design", files: e2e })).toStrictEqual([]);
    expect(ids({ rules, stage: "execute", files: ["src/app.ts"] })).toStrictEqual([]);
  });

  it("leaves a language pack out unless its name is in languages and a file matches", () => {
    const files = ["web/Form.tsx"];
    expect(ids({ files })).not.toContain("BDK-TS-1");
    expect(ids({ files, languages: ["typescript"] })).toContain("BDK-TS-1");
    expect(ids({ files, languages: ["typescript"] })).not.toContain("BDK-REACT-1");
    expect(ids({ files: ["src/a.py"], languages: ["typescript", "react"] })).toStrictEqual([
      "BDK-CQ-1",
      "BDK-DP-1",
    ]);
  });

  it("matches paths against every file of the set", () => {
    const rules = [rule("API-1", { paths: ["src/api/**"] })];
    expect(ids({ rules, files: ["docs/a.md"] })).toStrictEqual([]);
    expect(ids({ rules, files: ["docs/a.md", "src/api/login.ts"] })).toStrictEqual(["API-1"]);
    expect(ids({ rules, files: [] })).toStrictEqual([]);
  });

  it("skips tombstones and disabled rules, and lists the disabled ones", () => {
    const rules = [...PACK, rule("API-2", { removed: "superseded" }), rule("SECP-1")];
    const selection = selectRules({
      rules,
      stage: "review",
      files: ["src/a.py"],
      languages: [],
      disabled: ["BDK-DP-1"],
    });
    const selected = selection.selected.map((entry) => entry.rule.id);
    expect(selected).toContain("SECP-1");
    expect(selected).not.toContain("BDK-DP-1");
    expect(selected).not.toContain("API-2");
    expect(selection.disabled).toStrictEqual(["BDK-DP-1"]);
  });

  it("orders rules of every file first, then by glob specificity, since and id", () => {
    const rules = [
      rule("API-3", { paths: ["**/*.ts"] }),
      rule("API-2", { paths: ["src/api/**"] }),
      rule("API-1", { paths: ["src/api/login.ts", "**"] }),
      rule("NAMING-2", { since: "2026-09-01" }),
      rule("NAMING-1", { since: "2026-09-02" }),
      rule("NAMING-10", { since: "2026-09-02" }),
    ];
    const selection = selectRules({
      rules,
      stage: "execute",
      files: ["src/api/login.ts"],
      languages: [],
      disabled: [],
    });
    expect(selection.selected.map((entry) => [entry.rule.id, entry.matchedBy])).toStrictEqual([
      ["NAMING-2", "**"],
      ["NAMING-1", "**"],
      ["NAMING-10", "**"],
      ["API-1", "src/api/login.ts"],
      ["API-2", "src/api/**"],
      ["API-3", "**/*.ts"],
    ]);
  });

  it("selects every applying rule: there is no cap", () => {
    const rules = Array.from({ length: 120 }, (_, index) => rule(`API-${String(index + 1)}`));
    expect(ids({ rules })).toHaveLength(120);
  });
});
