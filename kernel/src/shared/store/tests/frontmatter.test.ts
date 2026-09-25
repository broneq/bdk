import { describe, expect, it } from "vitest";

import { splitFrontmatter } from "../index.ts";

describe("splitFrontmatter", () => {
  it("splits the leading YAML block from the body", () => {
    expect(splitFrontmatter("---\nid: L-1\nkind: x\n---\n# Body\n")).toStrictEqual({
      frontmatter: "id: L-1\nkind: x\n",
      body: "# Body\n",
    });
  });

  it("accepts an empty block and CRLF line ends", () => {
    expect(splitFrontmatter("---\n---\nbody")).toStrictEqual({ frontmatter: "", body: "body" });
    expect(splitFrontmatter("---\r\na: 1\r\n---\r\nbody")).toStrictEqual({
      frontmatter: "a: 1\r\n",
      body: "body",
    });
  });

  it("returns the whole text as body without a block", () => {
    expect(splitFrontmatter("# Title\n---\n")).toStrictEqual({ body: "# Title\n---\n" });
    expect(splitFrontmatter("---\nnever closed\n")).toStrictEqual({ body: "---\nnever closed\n" });
  });
});
