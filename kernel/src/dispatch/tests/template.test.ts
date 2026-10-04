// The package template's pure parts (`kernel-cli/dispatch`; T23-D33):
// normalisation for the hash and the role body's heading shift.
import { describe, expect, it } from "vitest";

import { demoteHeadings, normalise, renderSections } from "../domain/template.ts";
import { ENTRY_TYPES } from "../../shared/vocabulary/index.ts";

describe("normalise", () => {
  it("drops the frontmatter, CR line ends and trailing whitespace", () => {
    expect(normalise("---\nname: x\n---\n# Title  \r\nText\t\r\n\n")).toBe("# Title\nText");
  });

  it("leaves a text without frontmatter as is, trimmed", () => {
    expect(normalise("\nText\n")).toBe("Text");
  });
});

describe("demoteHeadings", () => {
  it("adds one level to every heading outside a fenced block", () => {
    expect(demoteHeadings("# A\n## B\n```md\n# not a heading\n```\nText #1")).toBe(
      "## A\n### B\n```md\n# not a heading\n```\nText #1",
    );
  });
});

describe("the return section (T46)", () => {
  const values: Record<string, string> = { ref: "A-1", report: "r.md" };
  const filled = new Proxy(values, { get: (target, key: string) => target[key] ?? "x" });
  const text = renderSections(filled, []).find((section) => section.name === "return")?.text ?? "";

  it("names the summary limit, the entry types and the ids to list", () => {
    expect(text).toContain("1 to 120 characters");
    for (const type of ENTRY_TYPES.filter((entry) => entry !== "transition")) {
      expect(text).toContain(type);
    }
    expect(text).toContain("the ids `log add` printed");
  });

  it("shows the pipe form of log ingest and says there is no frontmatter flag", () => {
    expect(text).toContain("bdk log ingest --ticket A-1 < ");
    expect(text).toContain("no frontmatter flag");
    expect(text).toContain("Leave `reason` out");
  });
});
