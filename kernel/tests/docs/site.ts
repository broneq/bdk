// Reads the documentation site (capability `docs-site`): the pages under
// docs/guide/ and the nav of mkdocs.yml.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDocument } from "yaml";
import type { ScalarTag } from "yaml";

import { REPO_ROOT } from "../support/run.ts";

export const SITE_DIR = join(REPO_ROOT, "docs", "guide");

// mkdocs.yml names a Python callable for the mermaid fence; the tag only has
// to parse, its value is never read.
const pythonName: ScalarTag = {
  tag: "tag:yaml.org,2002:python/name:pymdownx.superfences.fence_code_format",
  resolve: (value) => value,
};

/** Every `.md` page under docs/guide/, relative to it, sorted. */
export function sitePages(): string[] {
  if (!existsSync(SITE_DIR)) return [];
  return readdirSync(SITE_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".md"))
    .map((path) => relative(SITE_DIR, join(SITE_DIR, path)).split("\\").join("/"))
    .sort();
}

export function readPage(page: string): string {
  return readFileSync(join(SITE_DIR, page), "utf8");
}

function collectNav(node: unknown, into: string[]): void {
  if (typeof node === "string") {
    if (node.endsWith(".md")) into.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectNav(item, into);
  } else if (node !== null && typeof node === "object") {
    for (const value of Object.values(node)) collectNav(value, into);
  }
}

/** The mkdocs.yml config: its `docs_dir` and every page its `nav` names. */
export function readMkdocs(): { docsDir: unknown; nav: string[] } {
  const document = parseDocument(readFileSync(join(REPO_ROOT, "mkdocs.yml"), "utf8"), {
    customTags: [pythonName],
  });
  if (document.errors.length > 0 || document.warnings.length > 0) {
    throw new Error(`mkdocs.yml: ${[...document.errors, ...document.warnings].join("; ")}`);
  }
  const config = document.toJS() as { docs_dir?: unknown; nav?: unknown };
  const nav: string[] = [];
  collectNav(config.nav, nav);
  return { docsDir: config.docs_dir, nav };
}

/** A page that only includes another file (`--8<-- "CHANGELOG.md"`) and says nothing itself. */
export function isSnippetPage(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.length > 0 && lines.every((line) => line.startsWith("--8<--"));
}
