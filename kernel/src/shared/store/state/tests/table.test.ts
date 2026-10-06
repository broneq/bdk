import { describe, expect, it } from "vitest";

import { markdownTable } from "../table.ts";

describe("markdownTable", () => {
  it("pads every column to its widest cell, as Prettier aligns a table", () => {
    expect(
      markdownTable(
        ["Part", "Title", "Depends on"],
        [
          ["01", "Auth service", "-"],
          ["02", "Mail delivery", "01"],
        ],
      ),
    ).toBe(
      [
        "| Part | Title         | Depends on |",
        "| ---- | ------------- | ---------- |",
        "| 01   | Auth service  | -          |",
        "| 02   | Mail delivery | 01         |",
        "",
      ].join("\n"),
    );
  });

  it("keeps a rule of at least three dashes", () => {
    expect(markdownTable(["A"], [["b"]])).toBe("| A   |\n| --- |\n| b   |\n");
  });

  it("measures width in graphemes", () => {
    expect(markdownTable(["Name"], [["Zoë"]])).toBe("| Name |\n| ---- |\n| Zoë  |\n");
  });
});
