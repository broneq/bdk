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
/**
 * The site draws flowcharts with wrapping off (`theme/mermaid-diagram.ts`), so a label line is
 * as wide as its author wrote it (spec `docs-site`, "Flowchart label lines stay short").
 */
const MAX_LABEL_LINE = 40;

/** The parts of mermaid's flowchart database this test reads. */
interface FlowchartDb {
  getVertices(): Map<string, { text?: string }>;
  getEdges(): { text?: string }[];
  getSubGraphs(): { title?: string }[];
}

/** Each line of each node, edge and subgraph label, as the reader sees it. */
function labelLines(db: FlowchartDb): string[] {
  const labels = [
    ...[...db.getVertices().values()].map((vertex) => vertex.text),
    ...db.getEdges().map((edge) => edge.text),
    ...db.getSubGraphs().map((subgraph) => subgraph.title),
  ];
  return labels.flatMap((label) =>
    (label ?? "").split(/<br\s*\/?>/i).map((line) =>
      line
        .replace(/<[^>]*>/g, "")
        .replace(/&#?\w+;/g, "_")
        .trim(),
    ),
  );
}

async function problems(pages: ReadonlyMap<string, string>): Promise<string[]> {
  const found: string[] = [];
  for (const [path, page] of pages) {
    for (const block of mermaidBlocks(page)) {
      const at = `${path}:${String(block.line)}`;
      try {
        await mermaid.parse(block.code);
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        found.push(`${at}: ${message ?? ""}`);
        continue;
      }
      if (block.code.includes("wrappingWidth")) {
        found.push(`${at}: sets wrappingWidth; flowcharts use the site-wide value`);
      }
      // The parsed labels come only from the diagram's database: render() needs a browser's
      // layout (it draws an empty SVG in happy-dom), and parse() returns no diagram.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const diagram = await mermaid.mermaidAPI.getDiagramFromText(block.code);
      if (diagram.type.startsWith("flowchart")) {
        for (const line of labelLines(diagram.db as unknown as FlowchartDb)) {
          if (line.length > MAX_LABEL_LINE) {
            found.push(
              `${at}: label line over ${String(MAX_LABEL_LINE)} characters, break it with <br/>: ${line}`,
            );
          }
        }
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

  it("names a flowchart label line over the limit, in a node, an edge or a subgraph", async () => {
    const long = "writes R/debug/reproduction.md and R/debug/diagnosis.md";
    const page = [
      "```mermaid",
      "flowchart TB",
      `  subgraph S["${long}"]`,
      `    A["short<br/>${long}"] -->|"${long}"| B["a &lt;change&gt; name, and it is 40 chars long"]`,
      "  end",
      "```",
    ].join("\n");
    expect(await problems(new Map([["docs/concepts/x.md", page]]))).toEqual(
      Array.from(
        { length: 3 },
        () => `docs/concepts/x.md:1: label line over 40 characters, break it with <br/>: ${long}`,
      ),
    );
  });

  it("names a block that sets its own wrappingWidth", async () => {
    const page =
      '# Page\n\n```mermaid\n%%{init: {"flowchart": {"wrappingWidth": 200}}}%%\nflowchart TB\n  A --> B\n```\n';
    expect(await problems(new Map([["docs/concepts/x.md", page]]))).toEqual([
      "docs/concepts/x.md:3: sets wrappingWidth; flowcharts use the site-wide value",
    ]);
  });

  it("parse on every page of the site, with short flowchart label lines", async () => {
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
