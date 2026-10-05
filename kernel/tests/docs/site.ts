// Reads the documentation site (capability `docs-site`): the pages under
// docs/guide/, the sidebar of its VitePress config, and each page rendered by
// VitePress's own Markdown renderer for the anchor guard.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createMarkdownRenderer } from "vitepress";

import { markdown } from "../../../docs/guide/.vitepress/markdown.ts";
import { sidebar } from "../../../docs/guide/.vitepress/sidebar.ts";
import { REPO_ROOT } from "../support/run.ts";

const SITE_DIR = join(REPO_ROOT, "docs", "guide");

/** Every `.md` page under docs/guide/, relative to it, sorted; `.vitepress/` is config, not pages. */
export function sitePages(): string[] {
  if (!existsSync(SITE_DIR)) return [];
  return readdirSync(SITE_DIR, { recursive: true, encoding: "utf8" })
    .map((path) => relative(SITE_DIR, join(SITE_DIR, path)).split("\\").join("/"))
    .filter((path) => path.endsWith(".md") && !path.split("/").some((part) => part.startsWith(".")))
    .sort();
}

export function readPage(page: string): string {
  return readFileSync(join(SITE_DIR, page), "utf8");
}

/** The page a site link names: `/` and `dir/` are index pages, anything else gains `.md`. */
function linkPage(link: string): string {
  const path = link.replace(/^\//, "");
  return path === "" || path.endsWith("/") ? `${path}index.md` : `${path}.md`;
}

interface Item {
  readonly link?: string;
  readonly items?: readonly Item[];
}

function collect(items: readonly Item[], into: string[]): string[] {
  for (const item of items) {
    if (item.link !== undefined) into.push(linkPage(item.link));
    if (item.items !== undefined) collect(item.items, into);
  }
  return into;
}

/** Every page the sidebar names, in sidebar order. */
export function sidebarPages(): string[] {
  return collect(sidebar, []);
}

/** A page that only includes another file (`<!--@include: ../../CHANGELOG.md-->`) and says nothing itself. */
export function isSnippetPage(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.length > 0 && lines.every((line) => /^<!--@include: .+-->$/.test(line.trim()));
}

const renderer = createMarkdownRenderer(SITE_DIR, markdown, "/bdk/");

/** The page rendered as the site renders its Markdown, includes not expanded. */
export async function renderPage(page: string): Promise<string> {
  return (await renderer).render(readPage(page), {
    path: join(SITE_DIR, page),
    relativePath: page,
  });
}
