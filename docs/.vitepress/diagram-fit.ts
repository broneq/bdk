// Every diagram of the built site fits the desktop content column (spec `docs-site`, "Diagrams
// fit the content column"). Mermaid lays a diagram out only in a browser, so this check opens each
// page with a diagram in Chromium and measures what the reader sees. Run after `docs:build`.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { serve } from "vitepress";
import { mermaidBlocks } from "./mermaid-blocks.ts";

/** The desktop viewport: the content column leaves 574 px inside a diagram frame. */
export const DESKTOP_WIDTH = 1280;
/** A diagram drawn smaller than this share of its own size shows 14 px labels below 11 px. */
export const MIN_SCALE = 0.8;

const DOCS = join(import.meta.dirname, "..");
/** Not site pages: the archive stays out of the site, the rest is tooling. */
const SKIP = /^(v3-draft1|node_modules|\.vitepress)\//;

/** One drawn diagram as the browser shows it. */
export interface DrawnDiagram {
  /** Width of the diagram's own coordinate system (the SVG viewBox). */
  readonly naturalWidth: number;
  /** Width the page draws it at. */
  readonly drawnWidth: number;
  /** How far the diagram's frame scrolls sideways. */
  readonly overflow: number;
}

/** The site path of a page file: `concepts/rules.md` is `concepts/rules`, `guide/index.md` is `guide/`. */
export function pagePath(file: string): string {
  return file.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
}

/** What is wrong with the diagrams of one page, one line per diagram, with the block's line. */
export function fitProblems(
  page: string,
  blockLines: readonly number[],
  drawn: readonly DrawnDiagram[],
): string[] {
  if (drawn.length !== blockLines.length) {
    return [
      `${page}: ${String(blockLines.length)} mermaid blocks, ${String(drawn.length)} drawn diagrams`,
    ];
  }
  return drawn.flatMap((diagram, index) => {
    const at = `${page}:${String(blockLines[index])}`;
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
  });
}

/** Each site page with a mermaid block, with the line of each block, in page order. */
function pagesWithDiagrams(): Map<string, number[]> {
  const pages = new Map<string, number[]>();
  const files = readdirSync(DOCS, { recursive: true, encoding: "utf8" })
    .map((file) => file.split("\\").join("/"))
    .filter((file) => file.endsWith(".md") && !SKIP.test(file))
    .sort();
  for (const file of files) {
    const lines = mermaidBlocks(readFileSync(join(DOCS, file), "utf8")).map((block) => block.line);
    if (lines.length > 0) {
      pages.set(file, lines);
    }
  }
  return pages;
}

async function main(): Promise<void> {
  const port = 4179;
  const server = await serve({ root: DOCS, port });
  const browser = await chromium.launch();
  const found: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: DESKTOP_WIDTH, height: 900 } });
    for (const [file, blockLines] of pagesWithDiagrams()) {
      await page.goto(`http://localhost:${String(port)}/bdk/${pagePath(file)}`);
      // A diagram is drawn after the page mounts; a block that fails to draw shows its error.
      await page.waitForFunction(
        (count) => document.querySelectorAll(".mermaid svg, .mermaid-error").length >= count,
        blockLines.length,
      );
      const drawn = await page.$$eval(".mermaid", (frames) =>
        frames.flatMap((frame) => {
          const svg = frame.querySelector("svg");
          if (svg === null) {
            return [];
          }
          return [
            {
              naturalWidth: svg.viewBox.baseVal.width,
              drawnWidth: svg.getBoundingClientRect().width,
              overflow: frame.scrollWidth - frame.clientWidth,
            },
          ];
        }),
      );
      found.push(...fitProblems(`docs/${file}`, blockLines, drawn));
    }
  } finally {
    await browser.close();
    server.server.close();
  }
  if (found.length > 0) {
    console.error(`Diagrams wider than the content column at ${String(DESKTOP_WIDTH)} px:`);
    for (const problem of found) {
      console.error(`  ${problem}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
