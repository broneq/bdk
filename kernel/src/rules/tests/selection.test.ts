// Rule selection (`kernel-cli/rules`, bdk rules show, Selection): candidates,
// role sets, `applies` against the target's files, order and the cap.
import { describe, expect, it } from "vitest";

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
    origin: bundled ? "bdk" : "user",
    since: "2026-09-30",
    text: `Text of ${id}.`,
    ...extra,
  };
}

const PACK = [
  rule("BDK-CQ-1"),
  rule("BDK-ARCH-1"),
  rule("BDK-DP-1"),
  rule("BDK-SEC-1"),
  rule("BDK-TQ-1", { applies: ["**/*.test.ts"] }),
  rule("BDK-EJ-1"),
  rule("BDK-PL-1"),
  rule("BDK-TS-1", { pack: "languages/typescript", applies: ["**/*.ts", "**/*.tsx"] }),
  rule("BDK-REACT-1", { pack: "languages/react", applies: ["**/*.tsx"] }),
  rule("BDK-JS-1", { pack: "languages/javascript" }),
];

function ids(input: Partial<SelectionInput>): string[] {
  return selectRules({
    rules: PACK,
    role: "implementer",
    files: undefined,
    languages: [],
    disabled: [],
    ...input,
  }).selected.map((entry) => entry.rule.id);
}

describe("selectRules", () => {
  it("gives the writing roles CQ, ARCH, DP, SEC, TQ and the selected languages", () => {
    const files = ["web/Form.tsx"];
    expect(ids({ files, languages: ["typescript", "react"] })).toStrictEqual([
      "BDK-ARCH-1",
      "BDK-CQ-1",
      "BDK-DP-1",
      "BDK-SEC-1",
      "BDK-REACT-1",
      "BDK-TS-1",
    ]);
    for (const role of ["simplifier", "reviewer", "pr-reviewer"] as const) {
      expect(ids({ role, files, languages: ["typescript", "react"] })).toContain("BDK-REACT-1");
    }
  });

  it("gives the verifier ARCH, TQ, EJ and PL, and the design verifier ARCH, EJ and SEC", () => {
    expect(ids({ role: "verifier" })).toStrictEqual([
      "BDK-ARCH-1",
      "BDK-EJ-1",
      "BDK-PL-1",
      "BDK-TQ-1",
    ]);
    expect(ids({ role: "design-verifier" })).toStrictEqual(["BDK-ARCH-1", "BDK-EJ-1", "BDK-SEC-1"]);
  });

  it("gives the runner and the scout nothing, project rules included", () => {
    const rules = [...PACK, rule("API-1")];
    expect(ids({ rules, role: "runner" })).toStrictEqual([]);
    expect(ids({ rules, role: "scout" })).toStrictEqual([]);
  });

  it("leaves a language pack out unless its name is in languages", () => {
    expect(ids({ files: ["web/Form.tsx"] })).not.toContain("BDK-TS-1");
    expect(ids({ files: ["web/Form.tsx"], languages: ["javascript"] })).toContain("BDK-JS-1");
  });

  it("drops a rule whose applies misses every file, and keeps every rule without a file set", () => {
    expect(ids({ files: ["docs/a.md"] })).not.toContain("BDK-TQ-1");
    expect(ids({ files: ["src/a.test.ts"] })).toContain("BDK-TQ-1");
    expect(ids({ files: undefined })).toContain("BDK-TQ-1");
  });

  it("gives a project rule without roles to every reading role, and honours roles", () => {
    const rules = [rule("API-1"), rule("PLAN-1", { roles: ["verifier"] })];
    expect(ids({ rules, role: "reviewer" })).toStrictEqual(["API-1"]);
    expect(ids({ rules, role: "verifier" })).toStrictEqual(["API-1", "PLAN-1"]);
  });

  it("skips tombstones and disabled rules, and lists the disabled ones", () => {
    const rules = [...PACK, rule("API-2", { removed: "superseded" }), rule("SECP-1")];
    const selection = selectRules({
      rules,
      role: "reviewer",
      files: undefined,
      languages: [],
      disabled: ["BDK-SEC-1"],
    });
    const selected = selection.selected.map((entry) => entry.rule.id);
    expect(selected).toContain("SECP-1");
    expect(selected).not.toContain("BDK-SEC-1");
    expect(selected).not.toContain("API-2");
    expect(selection.disabled).toStrictEqual(["BDK-SEC-1"]);
  });

  it("orders global rules first, then by glob specificity, since and id", () => {
    const rules = [
      rule("API-3", { applies: ["**/*.ts"] }),
      rule("API-2", { applies: ["src/api/**"] }),
      rule("API-1", { applies: ["src/api/login.ts"] }),
      rule("NAMING-2", { since: "2026-09-01" }),
      rule("NAMING-1", { since: "2026-09-02" }),
      rule("NAMING-10", { since: "2026-09-02" }),
    ];
    const selection = selectRules({
      rules,
      role: "implementer",
      files: ["src/api/login.ts"],
      languages: [],
      disabled: [],
    });
    expect(selection.selected.map((entry) => [entry.rule.id, entry.matchedBy])).toStrictEqual([
      ["NAMING-2", null],
      ["NAMING-1", null],
      ["NAMING-10", null],
      ["API-1", "src/api/login.ts"],
      ["API-2", "src/api/**"],
      ["API-3", "**/*.ts"],
    ]);
  });

  it("selects every applying rule: there is no cap", () => {
    const rules = Array.from({ length: 120 }, (_, index) => rule(`API-${String(index + 1)}`));
    const selection = selectRules({
      rules,
      role: "implementer",
      files: undefined,
      languages: [],
      disabled: [],
    });
    expect(selection.selected).toHaveLength(120);
  });
});
