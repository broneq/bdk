// The package template's pure parts (`kernel-cli/dispatch`; T23-D33):
// normalisation for the hash and the role body's heading shift.
import { describe, expect, it } from "vitest";

import { demoteHeadings, normalise } from "../domain/template.ts";

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
