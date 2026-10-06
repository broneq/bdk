// `docs-site`, Site drift guards 5: every in-site link with an anchor names a
// heading of its target page. VitePress's dead-link check covers pages only,
// so this guard renders each page with VitePress's own Markdown renderer and
// reads the heading ids it writes.
import { posix } from "node:path";
import { createMarkdownRenderer } from "vitepress";
import { describe, expect, it } from "vitest";

import { renderPage, sitePages } from "./site.ts";

const HEADING_ID = /<h[1-6] id="([^"]+)"/g;
const LINK = /<a href="([^"]+)"(?![^>]*class="header-anchor")/g;

function decode(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/** The heading ids of rendered HTML. */
function headingIds(html: string): Set<string> {
  return new Set([...html.matchAll(HEADING_ID)].map((match) => decode(match[1] ?? "")));
}

/**
 * The in-site links of a rendered page that carry an anchor, as the target
 * page under docs/guide/ and the anchor. External links and links without an
 * anchor are left out: the build's dead-link check covers those.
 */
function anchorLinks(page: string, html: string): { target: string; anchor: string }[] {
  const links: { target: string; anchor: string }[] = [];
  for (const match of html.matchAll(LINK)) {
    const href = decode(match[1] ?? "");
    if (/^[a-z]+:/i.test(href) || !href.includes("#")) continue;
    const [path = "", anchor = ""] = href.split("#");
    let target = page;
    if (path !== "") {
      const resolved = path.startsWith("/")
        ? path.replace(/^\/bdk\//, "").replace(/^\//, "")
        : posix.join(posix.dirname(page), path);
      target = resolved.endsWith("/")
        ? `${resolved}index.md`
        : resolved.replace(/\.html$/, "").replace(/\.md$/, "") + ".md";
    }
    links.push({ target: posix.normalize(target), anchor: decodeURIComponent(anchor) });
  }
  return links;
}

describe("anchor extraction", () => {
  it("reads the ids VitePress writes, including code, punctuation and duplicates", async () => {
    const md = await createMarkdownRenderer(".", {}, "/bdk/");
    const ids = headingIds(
      md.render("# Run `bdk doctor`, then fix!\n\n## Same\n\n## Same\n\n## Custom {#my-id}\n", {}),
    );
    expect([...ids]).toStrictEqual(["run-bdk-doctor-then-fix", "same", "same-1", "my-id"]);
  });

  it("resolves same-page, relative and absolute links", () => {
    const html = [
      '<a href="#here">a</a>',
      '<a href="../reference/skills.html#bdk-cr">b</a>',
      '<a href="./change-pipeline.md#parts">c</a>',
      '<a href="/bdk/reference/">d</a>',
      '<a href="/bdk/reference/#top">e</a>',
      '<a href="https://example.com/#x">f</a>',
      '<a class="header-anchor" href="#self">g</a>',
    ].join("\n");
    expect(anchorLinks("concepts/agents.md", html)).toStrictEqual([
      { target: "concepts/agents.md", anchor: "here" },
      { target: "reference/skills.md", anchor: "bdk-cr" },
      { target: "concepts/change-pipeline.md", anchor: "parts" },
      { target: "reference/index.md", anchor: "top" },
    ]);
  });
});

describe("anchors", async () => {
  const pages = sitePages();
  const rendered = new Map(
    await Promise.all(pages.map(async (page) => [page, await renderPage(page)] as const)),
  );
  const links = pages.flatMap((page) =>
    anchorLinks(page, rendered.get(page) ?? "").map((link) => ({ page, ...link })),
  );

  it("finds links with anchors to check", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links)("$page links to $target#$anchor", ({ target, anchor }) => {
    const html = rendered.get(target);
    expect(html, `${target} is a site page`).toBeDefined();
    expect([...headingIds(html ?? "")], `${target} has #${anchor}`).toContain(anchor);
  });
});
