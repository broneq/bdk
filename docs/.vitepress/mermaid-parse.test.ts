// @vitest-environment happy-dom
// mermaid's parser needs a DOM (DOMPurify); happy-dom stands in for the browser.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mermaid from "mermaid";
import { describe, expect, it } from "vitest";
import { mermaidBlocks } from "./mermaid-blocks.ts";

const DOCS = join(import.meta.dirname, "..");
/** Not site pages: the archive stays out of the site, the rest is tooling. */
const SKIP = /^(v3-draft1|node_modules|\.vitepress)\//;

async function problems(pages: ReadonlyMap<string, string>): Promise<string[]> {
  const found: string[] = [];
  for (const [path, page] of pages) {
    for (const block of mermaidBlocks(page)) {
      try {
        await mermaid.parse(block.code);
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        found.push(`${path}:${block.line}: ${message ?? ""}`);
      }
    }
  }
  return found;
}

describe("mermaidBlocks", () => {
  it("finds each mermaid block with the line of its fence, and skips other fences", () => {
    const page = [
      "# Page",
      "```mermaid",
      "flowchart TB",
      "  A --> B",
      "```",
      "```text",
      "```mermaid",
      "```",
    ].join("\n");
    expect(mermaidBlocks(page)).toEqual([{ line: 2, code: "flowchart TB\n  A --> B" }]);
  });
});

describe("mermaid blocks", () => {
  it("names the page and line of a block that does not parse", async () => {
    const page = "# Page\n\n```mermaid\nflowchart TB\n  A -->\n```\n";
    expect(await problems(new Map([["docs/concepts/x.md", page]]))).toEqual([
      expect.stringMatching(/^docs\/concepts\/x\.md:3: /),
    ]);
  });

  it("parse on every page of the site", async () => {
    const files = readdirSync(DOCS, { recursive: true, encoding: "utf8" })
      .map((file) => file.split("\\").join("/"))
      .filter((file) => file.endsWith(".md") && !SKIP.test(file))
      .sort();
    const pages = new Map(
      files.map((file) => [`docs/${file}`, readFileSync(join(DOCS, file), "utf8")]),
    );
    expect(await problems(pages)).toEqual([]);
  });
});
