import { describe, expect, it } from "vitest";

import { splitFrontmatter } from "../../frontmatter.ts";
import { renderDocument } from "../render.ts";

describe("renderDocument", () => {
  it("separates a body from the frontmatter by one blank line", () => {
    expect(renderDocument({ schema: 1 }, "Body.\n")).toBe("---\nschema: 1\n---\n\nBody.\n");
  });

  it("ends an empty body right after the closing line", () => {
    expect(renderDocument({ schema: 1 }, "")).toBe("---\nschema: 1\n---\n");
  });

  it("ends a body with one newline", () => {
    expect(renderDocument({ schema: 1 }, "Body.")).toBe("---\nschema: 1\n---\n\nBody.\n");
  });

  it("writes flow sequences without inner padding", () => {
    expect(renderDocument({ files: ["a.ts", "b.ts"], entries: [] }, "PASS\n", "flow")).toBe(
      "---\nfiles: [a.ts, b.ts]\nentries: []\n---\n\nPASS\n",
    );
  });

  it.each([
    ["the old shape", "---\nschema: 1\n---\nBody.\n"],
    ["the separated shape", "---\nschema: 1\n---\n\nBody.\n"],
  ])("rewrites %s to the current shape, then stays byte-stable", (_, text) => {
    const once = splitFrontmatter(text);
    const written = renderDocument({ schema: 1 }, once.body);
    expect(written).toBe("---\nschema: 1\n---\n\nBody.\n");
    expect(renderDocument({ schema: 1 }, splitFrontmatter(written).body)).toBe(written);
  });
});
