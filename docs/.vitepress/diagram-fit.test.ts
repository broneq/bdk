import { describe, expect, it } from "vitest";
import { fitProblems, pagePath } from "./diagram-fit.ts";

describe("pagePath", () => {
  it("drops .md, and an index page is its directory", () => {
    expect(pagePath("concepts/rules.md")).toBe("concepts/rules");
    expect(pagePath("guide/index.md")).toBe("guide/");
    expect(pagePath("index.md")).toBe("");
  });
});

describe("fitProblems", () => {
  const page = "docs/concepts/x.md";

  it("passes a diagram drawn at 0.8 of its size or more, whose frame does not scroll", () => {
    expect(
      fitProblems(
        page,
        [3, 20],
        [
          { naturalWidth: 500, drawnWidth: 500, overflow: 0 },
          { naturalWidth: 717, drawnWidth: 574, overflow: 0 },
        ],
      ),
    ).toEqual([]);
  });

  it("names the block line, the scale and the widest diagram that fits", () => {
    expect(
      fitProblems(
        page,
        [3, 20],
        [
          { naturalWidth: 500, drawnWidth: 500, overflow: 0 },
          { naturalWidth: 960, drawnWidth: 576, overflow: 2 },
        ],
      ),
    ).toEqual([
      "docs/concepts/x.md:20: drawn at 0.60 of its size (960 px wide); at most 720 px fits at 0.8",
      "docs/concepts/x.md:20: its frame scrolls sideways by 2 px",
    ]);
  });

  it("names a page whose blocks did not all draw", () => {
    expect(
      fitProblems(page, [3, 20], [{ naturalWidth: 500, drawnWidth: 500, overflow: 0 }]),
    ).toEqual(["docs/concepts/x.md: 2 mermaid blocks, 1 drawn diagrams"]);
  });
});
