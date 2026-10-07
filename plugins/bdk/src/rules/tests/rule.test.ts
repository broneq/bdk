import { describe, expect, it } from "vitest";

import { isRuleFile, parseRule } from "../domain/rule.ts";
import type { Rule } from "../domain/rule.ts";

// The rule file format of spec `rule-pack`, "Rule file".

const HOUSE = `---
kind: house
paths: ["**"]
stages: [plan, execute, review]
---

**Naming.** Descriptive identifiers.
`;

function parse(relPath: string, content: string, origin: Rule["origin"] = "bdk"): Rule | string {
  return parseRule({ relPath, file: `rules/${relPath}`, origin, content });
}

describe("rule files", () => {
  it("reads a house rule: id from the file name, no language, the text without frontmatter", () => {
    expect(parse("code-quality/BDK-CQ-1.md", HOUSE)).toEqual({
      id: "BDK-CQ-1",
      origin: "bdk",
      language: null,
      file: "rules/code-quality/BDK-CQ-1.md",
      kind: "house",
      paths: ["**"],
      stages: ["plan", "execute", "review"],
      source: null,
      verified: null,
      measured: null,
      text: "**Naming.** Descriptive identifiers.",
    });
  });

  it("reads a knowledge rule with its source, date and measurement, in a language pack", () => {
    const rule = parse(
      "languages/react/BDK-REACT-9.md",
      [
        "---",
        "kind: knowledge",
        'paths: ["**/*.tsx"]',
        "stages: [review]",
        'source: "https://react.dev/blog/2024/12/05/react-19"',
        "verified: 2026-09-30",
        "measured:",
        "  report: docs/r.md",
        "  bullet: languages/react.10.b94cb0a5",
        "  class: effective",
        "---",
        "Text.",
        "",
      ].join("\r\n"),
    );
    expect(rule).toMatchObject({
      id: "BDK-REACT-9",
      language: "react",
      kind: "knowledge",
      source: "https://react.dev/blog/2024/12/05/react-19",
      verified: "2026-09-30",
      measured: { report: "docs/r.md", bullet: "languages/react.10.b94cb0a5", class: "effective" },
      text: "Text.",
    });
  });

  it.each([
    ["a knowledge rule without source", HOUSE.replace("house", "knowledge"), "source"],
    [
      "a house rule with a source",
      HOUSE.replace("kind: house", "kind: house\nsource: x"),
      "source",
    ],
    ["an unknown field", HOUSE.replace("kind: house", "kind: house\nseverity: high"), "severity"],
    ["an unknown stage", HOUSE.replace("plan, execute", "deploy, execute"), "stages"],
    ["a repeated stage", HOUSE.replace("plan, execute", "plan, plan"), "stages"],
    ["no paths", HOUSE.replace('paths: ["**"]', "paths: []"), "paths"],
    ["an unknown kind", HOUSE.replace("house", "habit"), "kind"],
    ["an empty text", HOUSE.replace("**Naming.** Descriptive identifiers.", "  "), "rule text"],
    ["no frontmatter", "Just text.\n", "frontmatter"],
    ["an unclosed frontmatter", "---\nkind: house\n", "frontmatter"],
    ["frontmatter that is not a mapping", "---\n- a\n---\nText.\n", "mapping"],
    ["broken YAML", "---\nkind: [house\n---\nText.\n", "YAML"],
    [
      "a bad verified date",
      HOUSE.replace("house", "knowledge").replace(
        "kind: knowledge",
        "kind: knowledge\nsource: s\nverified: soon",
      ),
      "verified",
    ],
  ])("rejects %s", (_, content, word) => {
    const problem = parse("code-quality/BDK-CQ-1.md", content);
    expect(typeof problem).toBe("string");
    expect(problem).toContain(word);
  });

  it("reads a frontmatter after a byte order mark and with trailing spaces on its fences", () => {
    expect(parse("x/BDK-X-1.md", `\uFEFF${HOUSE.replace(/^---$/gm, "---  ")}`)).toMatchObject({
      id: "BDK-X-1",
      kind: "house",
    });
  });

  it("rejects an id that is not letters, digits and dashes", () => {
    expect(parse("x/my rule.md", HOUSE)).toContain("id");
  });

  it("rejects a project rule with the BDK- prefix", () => {
    expect(parse("BDK-CQ-1.md", HOUSE, "project")).toContain("BDK-");
    expect(parse("API-1.md", HOUSE, "project")).toMatchObject({ id: "API-1", origin: "project" });
  });

  it("counts only Markdown files other than README.md as rules", () => {
    expect(isRuleFile("languages/react/BDK-REACT-2.md")).toBe(true);
    expect(isRuleFile("README.md")).toBe(false);
    expect(isRuleFile("languages/README.md")).toBe(false);
    expect(isRuleFile("notes.txt")).toBe(false);
  });
});
