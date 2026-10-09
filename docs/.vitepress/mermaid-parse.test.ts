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
 * The site draws flowcharts and sequence diagrams with wrapping off (`theme/mermaid-diagram.ts`),
 * so a label line is as wide as its author wrote it (spec `docs-site`, "Diagram label lines stay
 * short").
 */
const MAX_LABEL_LINE = 40;
/**
 * An init directive or a `config:` frontmatter. Wrapping and layout are set once for the site
 * (`theme/mermaid-diagram.ts`), so a diagram fits the content column the same way on every page
 * (spec `docs-site`, "Diagrams fit the content column").
 */
const OWN_CONFIG = /%%\{\s*init(ialize)?\s*:|^\s*---\s*\n[\s\S]*?^\s*config\s*:/m;

/** The parts of mermaid's flowchart database this test reads. */
interface FlowchartDb {
  getVertices(): Map<string, { text?: string }>;
  getEdges(): { text?: string }[];
  getSubGraphs(): { title?: string }[];
}

/** One text of a sequence diagram and whether mermaid wraps it. */
interface SequenceText {
  wrap?: boolean;
}

/**
 * The parts of mermaid's sequence database this test reads. Messages hold the notes and the
 * block labels (`loop`, `alt`, `par`, ...) too.
 */
interface SequenceDb {
  getActors(): Map<string, SequenceText & { description?: string }>;
  getMessages(): (SequenceText & { message?: string })[];
  getBoxes(): (SequenceText & { name?: string })[];
}

/** Each node, edge and subgraph label of a flowchart. */
function flowchartLabels(db: FlowchartDb): (string | undefined)[] {
  return [
    ...[...db.getVertices().values()].map((vertex) => vertex.text),
    ...db.getEdges().map((edge) => edge.text),
    ...db.getSubGraphs().map((subgraph) => subgraph.title),
  ];
}

/** Each participant name, message, note, block label and box name of a sequence diagram. */
function sequenceTexts(db: SequenceDb): { text: string | undefined; wrap: boolean | undefined }[] {
  return [
    ...[...db.getActors().values()].map((actor) => ({ text: actor.description, wrap: actor.wrap })),
    ...db.getMessages().map((message) => ({ text: message.message, wrap: message.wrap })),
    ...db.getBoxes().map((box) => ({ text: box.name, wrap: box.wrap })),
  ];
}

/** Each line of each label, as the reader sees it. */
function labelLines(labels: (string | undefined)[]): string[] {
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
      if (OWN_CONFIG.test(block.code)) {
        found.push(`${at}: sets its own Mermaid configuration; diagrams use the site-wide one`);
      }
      // The parsed labels come only from the diagram's database: render() needs a browser's
      // layout (it draws an empty SVG in happy-dom), and parse() returns no diagram.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const diagram = await mermaid.mermaidAPI.getDiagramFromText(block.code);
      let labels: (string | undefined)[] = [];
      if (diagram.type.startsWith("flowchart")) {
        labels = flowchartLabels(diagram.db as unknown as FlowchartDb);
      } else if (diagram.type === "sequence") {
        const texts = sequenceTexts(diagram.db as unknown as SequenceDb);
        // Wrapping cuts a word wider than the box into pieces with a hyphen of its own
        // (`/bdk:pr-rev-` / `iew`), so it stays off whichever way a block turns it on.
        if (texts.some((text) => text.wrap === true)) {
          found.push(`${at}: wraps text; sequence diagrams break lines only at <br/>`);
        }
        labels = texts.map((text) => text.text);
      }
      for (const line of labelLines(labels)) {
        if (line.length > MAX_LABEL_LINE) {
          found.push(
            `${at}: label line over ${String(MAX_LABEL_LINE)} characters, break it with <br/>: ${line}`,
          );
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

  it("names a sequence line over the limit, in a participant, a message, a note or a block", async () => {
    const long = "bdk check run round-N --at review --changed base --round N";
    const page = [
      "```mermaid",
      "sequenceDiagram",
      `  box transparent ${long}`,
      `    participant L as short<br/>${long}`,
      "  end",
      `  loop ${long}`,
      `    L->>L: ${long}`,
      `    Note over L: ${long}`,
      "  end",
      // `;` ends a sequence statement, so this edge case has no HTML entity.
      "  L->>L: a change name, and this is 40 chars long",
      "```",
    ].join("\n");
    expect((await problems(new Map([["docs/concepts/x.md", page]]))).sort()).toEqual(
      Array.from(
        { length: 5 },
        () => `docs/concepts/x.md:1: label line over 40 characters, break it with <br/>: ${long}`,
      ),
    );
  });

  it.each([
    ["the wrap directive", "%%{wrap}%%\nsequenceDiagram\n  A->>B: hi"],
    ["a wrap: prefix", "sequenceDiagram\n  A->>B: wrap: hi"],
  ])("names a sequence diagram that turns wrapping on in %s", async (_, code) => {
    const page = `# Page\n\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
    expect(await problems(new Map([["docs/concepts/x.md", page]]))).toEqual([
      "docs/concepts/x.md:3: wraps text; sequence diagrams break lines only at <br/>",
    ]);
  });

  it.each([
    ["an init line", '%%{init: {"flowchart": {"wrappingWidth": 200}}}%%\nflowchart TB\n  A --> B'],
    [
      "an initialize line",
      '%%{initialize: {"sequence": {"actorMargin": 50}}}%%\nsequenceDiagram\n  A->>B: hi',
    ],
    [
      "a config frontmatter",
      "---\nconfig:\n  flowchart:\n    wrappingWidth: 200\n---\nflowchart TB\n  A --> B",
    ],
  ])("names a block that sets its own configuration in %s", async (_, code) => {
    const page = `# Page\n\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
    expect(await problems(new Map([["docs/concepts/x.md", page]]))).toEqual([
      "docs/concepts/x.md:3: sets its own Mermaid configuration; diagrams use the site-wide one",
    ]);
  });

  it("names a sequence diagram that turns wrapping on in an init line, as both", async () => {
    const page =
      '# Page\n\n```mermaid\n%%{init: {"sequence": {"wrap": true}}}%%\nsequenceDiagram\n  A->>B: hi\n```\n';
    expect(await problems(new Map([["docs/concepts/x.md", page]]))).toEqual([
      "docs/concepts/x.md:3: sets its own Mermaid configuration; diagrams use the site-wide one",
      "docs/concepts/x.md:3: wraps text; sequence diagrams break lines only at <br/>",
    ]);
  });

  it("parse on every page of the site, with short label lines, no own configuration and no sequence wrapping", async () => {
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
