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

  it("consumes one blank line after the block as the separator", () => {
    expect(splitFrontmatter("---\na: 1\n---\n\n# Body\n")).toStrictEqual({
      frontmatter: "a: 1\n",
      body: "# Body\n",
    });
    expect(splitFrontmatter("---\r\na: 1\r\n---\r\n\r\nbody")).toStrictEqual({
      frontmatter: "a: 1\r\n",
      body: "body",
    });
  });

  it("keeps a second blank line as body", () => {
    expect(splitFrontmatter("---\na: 1\n---\n\n\nbody\n").body).toBe("\nbody\n");
  });

  it("reads the old shape and the separated shape to the same body", () => {
    const old = splitFrontmatter("---\na: 1\n---\nText.\n");
    expect(splitFrontmatter("---\na: 1\n---\n\nText.\n")).toStrictEqual(old);
  });

  it("returns the whole text as body without a block", () => {
    expect(splitFrontmatter("# Title\n---\n")).toStrictEqual({ body: "# Title\n---\n" });
    expect(splitFrontmatter("---\nnever closed\n")).toStrictEqual({ body: "---\nnever closed\n" });
  });
});
