// Every diagram of the built site fits the desktop content column and shows its labels on the lines
// their authors wrote (spec `docs-site`, "Diagrams fit the content column" and "Drawn labels keep
// their author's lines"). Mermaid lays a diagram out only in a browser, so this check opens each
// page with a diagram in Chromium and measures what the reader sees. Run after `docs:build`.

import { once } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, errors } from "playwright";
import { serve } from "vitepress";
import { type MermaidBlock, mermaidBlocks } from "./mermaid-blocks.ts";

/** The desktop viewport: the content column leaves 574 px inside a diagram frame. */
export const DESKTOP_WIDTH = 1280;
/** A diagram drawn smaller than this share of its own size shows 14 px labels below 11 px. */
export const MIN_SCALE = 0.8;

/** How long a page's diagrams may take to draw before the check measures them as they are. */
const DRAW_TIMEOUT = 30_000;

const DOCS = join(import.meta.dirname, "..");
/** Not site pages: the archive stays out of the site, the rest is tooling. */
const SKIP = /^(v3-draft1|node_modules|\.vitepress)\//;

/** One HTML label of a flowchart as drawn. */
export interface DrawnLabel {
  /** Its text, with a `<br/>` where its author broke a line. */
  readonly text: string;
  /** The lines it shows. */
  readonly lines: number;
}

/** One drawn line of a sequence block label (`alt`, `else`, `loop`, `par`, `and`, ...). */
export interface DrawnBlockText {
  readonly text: string;
  /** How far, in the diagram's own pixels, it runs past the inside of its block's frame. */
  readonly overflow: number;
}

/** One diagram frame as the browser shows it. */
export interface DrawnDiagram {
  /** Width of the diagram's own coordinate system (the SVG viewBox); 0 when it is not drawn. */
  readonly naturalWidth: number;
  /** Width the page draws it at. */
  readonly drawnWidth: number;
  /** How far the diagram's frame scrolls sideways. */
  readonly overflow: number;
  /** Each non-empty flowchart node, edge and subgraph label. */
  readonly labels: readonly DrawnLabel[];
  /** Each drawn line of each sequence block label. */
  readonly blockTexts: readonly DrawnBlockText[];
  /** The Mermaid error the frame shows instead of a diagram. */
  readonly error?: string;
}

/** A sequence block statement and its label: `alt Status: done`, `else`, `par in parallel`. */
const BLOCK_STATEMENT = /^\s*(?:loop|alt|else|opt|par|par_over|and|critical|option|break)\b(.*)$/;
const LINE_BREAK = /<br\s*\/?>/i;

/**
 * Each line of each block label of a sequence diagram, as Mermaid draws it: the label in brackets,
 * split at its author's `<br/>`.
 */
export function blockLabelLines(code: string): Set<string> {
  const lines = new Set<string>();
  for (const statement of code.split("\n")) {
    const label = BLOCK_STATEMENT.exec(statement)?.[1]?.trim();
    if (label) {
      for (const line of `[${label}]`.split(LINE_BREAK)) {
        lines.add(line.trim());
      }
    }
  }
  return lines;
}

/** The site path of a page file: `concepts/rules.md` is `concepts/rules`, `guide/index.md` is `guide/`. */
export function pagePath(file: string): string {
  return file.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
}

/** What is wrong with the diagrams of one page, one line per problem, with the block's line. */
export function diagramProblems(
  page: string,
  blocks: readonly MermaidBlock[],
  drawn: readonly DrawnDiagram[],
): string[] {
  if (drawn.length !== blocks.length) {
    return [
      `${page}: ${String(blocks.length)} mermaid blocks, ${String(drawn.length)} drawn diagrams`,
    ];
  }
  return blocks.flatMap((block, index) => {
    const diagram = drawn[index];
    if (diagram === undefined) {
      return [];
    }
    const at = `${page}:${String(block.line)}`;
    if (diagram.error !== undefined) {
      return [`${at}: does not draw: ${diagram.error}`];
    }
    // A scale read from a diagram not yet laid out is Infinity or NaN, and would pass.
    if (!(Number.isFinite(diagram.naturalWidth) && diagram.naturalWidth > 0)) {
      return [`${at}: not laid out, so its fit cannot be measured`];
    }
    return [...fitProblems(at, diagram), ...labelProblems(at, block.code, diagram)];
  });
}

function fitProblems(at: string, diagram: DrawnDiagram): string[] {
  const scale = diagram.drawnWidth / diagram.naturalWidth;
  const found: string[] = [];
  if (scale < MIN_SCALE) {
    const widest = Math.floor(diagram.drawnWidth / MIN_SCALE);
    found.push(
      `${at}: drawn at ${scale.toFixed(2)} of its size (${String(Math.round(diagram.naturalWidth))} px wide); at most ${String(widest)} px fits at ${String(MIN_SCALE)}`,
    );
  }
  if (diagram.overflow > 0) {
    found.push(`${at}: its frame scrolls sideways by ${String(diagram.overflow)} px`);
  }
  return found;
}

/**
 * Labels Mermaid broke at a space of its own choosing. A flowchart label shows more lines than
 * its `<br/>` make. A sequence block label wider than its block is broken by Mermaid whatever
 * `sequence.wrap` says, so a drawn line that is no line of the source names that label; a line
 * kept as written but wider than the block runs past the block's frame.
 */
function labelProblems(at: string, code: string, diagram: DrawnDiagram): string[] {
  const found: string[] = [];
  for (const label of diagram.labels) {
    const written = label.text.split(LINE_BREAK).length;
    if (label.lines !== written) {
      found.push(
        `${at}: label "${label.text}" shows ${String(label.lines)} lines, its source ${String(written)}`,
      );
    }
  }
  if (diagram.blockTexts.length === 0) {
    return found;
  }
  const sourceLines = blockLabelLines(code);
  const broken = new Set<string>();
  for (const { text, overflow } of diagram.blockTexts) {
    if (!sourceLines.has(text)) {
      broken.add(blockLabelOf(code, text) ?? text);
    } else if (overflow > 0) {
      found.push(
        `${at}: block label line "${text}" runs ${String(Math.ceil(overflow))} px past its block; break it with <br/>`,
      );
    }
  }
  for (const label of broken) {
    found.unshift(
      `${at}: block label "${label}" is wider than its block, so Mermaid breaks it; break it with <br/>`,
    );
  }
  return found;
}

/** The source block label, in brackets, that a line Mermaid broke out of it is part of. */
function blockLabelOf(code: string, part: string): string | undefined {
  return code
    .split("\n")
    .map((statement) => BLOCK_STATEMENT.exec(statement)?.[1]?.trim())
    .filter((label): label is string => Boolean(label))
    .map((label) => `[${label}]`)
    .find((label) => label.replace(/\s+/g, " ").includes(part));
}

/** Each site page with a mermaid block, with its blocks, in page order. */
function pagesWithDiagrams(): Map<string, MermaidBlock[]> {
  const pages = new Map<string, MermaidBlock[]>();
  const files = readdirSync(DOCS, { recursive: true, encoding: "utf8" })
    .map((file) => file.split("\\").join("/"))
    .filter((file) => file.endsWith(".md") && !SKIP.test(file))
    .sort();
  for (const file of files) {
    const blocks = mermaidBlocks(readFileSync(join(DOCS, file), "utf8"));
    if (blocks.length > 0) {
      pages.set(file, blocks);
    }
  }
  return pages;
}

/**
 * Whether every diagram frame of a page is drawn or shows its error. A frame still drawing shows
 * its source (`mermaid-source`) and holds Mermaid's scratch SVG, which has no viewBox yet; a drawn
 * frame holds the diagram's SVG as its child. It runs in the browser.
 */
function allDrawn(count: number): boolean {
  const frames = [...document.querySelectorAll(".mermaid")];
  return (
    frames.length >= count &&
    frames.every(
      (frame) =>
        frame.querySelector(".mermaid-error") !== null ||
        (!frame.classList.contains("mermaid-source") &&
          (frame.querySelector<SVGSVGElement>(":scope > svg")?.viewBox.baseVal.width ?? 0) > 0),
    )
  );
}

/**
 * Measures each diagram frame of a page, one entry per frame. It runs in the browser, so it uses
 * nothing from this module.
 */
function measureDiagrams(frames: Element[]): DrawnDiagram[] {
  /** The lines an element's text shows: text boxes that overlap vertically share a line. */
  function lineCount(element: Element): number {
    const boxes: DOMRect[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        boxes.push(...range.getClientRects());
      }
    }
    boxes.sort((a, b) => a.top - b.top);
    let lines = 0;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const box of boxes) {
      if (box.top >= bottom - 1) {
        lines += 1;
        bottom = box.bottom;
      } else {
        bottom = Math.max(bottom, box.bottom);
      }
    }
    return lines;
  }

  /** An HTML label's text with a `<br/>` at each of its line breaks. */
  function labelText(element: Element): string {
    const copy = element.cloneNode(true) as Element;
    for (const lineBreak of copy.querySelectorAll("br")) {
      lineBreak.replaceWith("\n");
    }
    return copy.textContent
      .split("\n")
      .map((line) => line.trim())
      .join("<br/>");
  }

  /**
   * Each line of each sequence block label, and how far it runs past the inside of the innermost
   * block frame around it: past the frame's sides, and on the frame's top row past its label tab
   * (`alt`, `loop`). The box behind the text (`label-backing.ts`) reaches 4 px further each side
   * and would hide the frame line under it.
   */
  function blockTexts(svg: SVGSVGElement, scale: number): DrawnBlockText[] {
    const padding = 4 * scale;
    const blocks = [...svg.querySelectorAll('g[data-et="control-structure"]')].map((group) => ({
      frame: group.getBoundingClientRect(),
      tab: group.querySelector("polygon.labelBox")?.getBoundingClientRect(),
    }));
    return [...svg.querySelectorAll("text.loopText, text.sectionTitle")].map((text) => {
      const box = text.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const block = blocks
        .filter(
          ({ frame }) => frame.left <= x && x <= frame.right && frame.top <= y && y <= frame.bottom,
        )
        .sort((a, b) => a.frame.width * a.frame.height - b.frame.width * b.frame.height)[0];
      let overflow = 0;
      if (block) {
        const tab = text.classList.contains("loopText") ? block.tab : undefined;
        const left = (tab ? tab.right : block.frame.left) + padding;
        const right = block.frame.right - padding;
        overflow = Math.max(left - box.left, box.right - right, 0) / scale;
      }
      return { text: text.textContent.replace(/\s+/g, " ").trim(), overflow };
    });
  }

  return frames.map((frame) => {
    const error = frame
      .querySelector(".mermaid-error")
      ?.textContent.replace(/^Diagram error: /, "");
    // Only a drawn frame's own SVG: one still drawing holds Mermaid's scratch SVG, not laid out.
    const svg = frame.classList.contains("mermaid-source")
      ? null
      : frame.querySelector<SVGSVGElement>(":scope > svg");
    if (error !== undefined || svg === null) {
      return {
        naturalWidth: 0,
        drawnWidth: 0,
        overflow: 0,
        labels: [],
        blockTexts: [],
        ...(error === undefined ? {} : { error }),
      };
    }
    const naturalWidth = svg.viewBox.baseVal.width;
    const drawnWidth = svg.getBoundingClientRect().width;
    return {
      naturalWidth,
      drawnWidth,
      overflow: frame.scrollWidth - frame.clientWidth,
      labels: [...svg.querySelectorAll("foreignObject > div")]
        .filter((label) => label.textContent.trim())
        .map((label) => ({ text: labelText(label), lines: lineCount(label) })),
      blockTexts: naturalWidth > 0 ? blockTexts(svg, drawnWidth / naturalWidth) : [],
    };
  });
}

async function main(): Promise<void> {
  // Port 0 lets the OS pick a free port, so runs from several worktrees never collide.
  const server = await serve({ root: DOCS, port: 0 });
  if (!server.server.listening) {
    await once(server.server, "listening");
  }
  const address = server.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The docs server has no TCP port");
  }
  const port = address.port;
  const browser = await chromium.launch();
  const found: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: DESKTOP_WIDTH, height: 900 } });
    for (const [file, blocks] of pagesWithDiagrams()) {
      await page.goto(`http://localhost:${String(port)}/bdk/${pagePath(file)}`);
      // A diagram is drawn after the page mounts; a block that fails to draw shows its error.
      // One still not drawn when the wait ends is measured as it is and fails, named by its line.
      await page
        .waitForFunction(allDrawn, blocks.length, { timeout: DRAW_TIMEOUT })
        .catch((reason: unknown) => {
          if (!(reason instanceof errors.TimeoutError)) {
            throw reason;
          }
        });
      const drawn = await page.$$eval(".mermaid", measureDiagrams);
      found.push(...diagramProblems(`docs/${file}`, blocks, drawn));
    }
  } finally {
    await browser.close();
    server.server.close();
  }
  if (found.length > 0) {
    console.error(`Diagram problems at ${String(DESKTOP_WIDTH)} px:`);
    for (const problem of found) {
      console.error(`  ${problem}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
