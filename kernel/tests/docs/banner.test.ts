// `docs-site`, v2 banner: until T50 rewrites a page for v3, it opens with the
// banner directly under its title; a page a task already rewrote for v3 is
// listed here and carries none. T50 removes this test with the banners.
import { describe, expect, it } from "vitest";

import { isSnippetPage, readPage, sitePages } from "./site.ts";

const BANNER = [
  "::: warning Describes BDK v2",
  "This page describes BDK v2. The v3 documentation replaces it (T50).",
  ":::",
];

/** Pages rewritten for v3 before T50, each by the task named. */
const V3_PAGES = [
  "concepts/quality-and-language-rules.md", // T31
  "workflows/rules-hygiene.md", // T31
  "getting-started/setup.md", // T41
  "concepts/agents.md", // T42
  "reference/agents.md", // T42
  "workflows/code-review.md", // T42
  "workflows/debugging.md", // T42
  "concepts/worktree-parts.md", // T45
  "workflows/diagnostics.md", // T47
];

const pages = sitePages().filter(
  (page) => !isSnippetPage(readPage(page)) && !V3_PAGES.includes(page),
);

describe("v2 banner", () => {
  it("covers at least one page", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(V3_PAGES)("%s, rewritten for v3, carries no banner", (page) => {
    expect(readPage(page)).not.toContain("Describes BDK v2");
  });

  it.each(pages)("%s opens with the banner under its title", (page) => {
    const lines = readPage(page).split("\n");
    const title = lines.findIndex((line) => line.startsWith("# "));
    expect(title, "an H1 title").toBeGreaterThanOrEqual(0);
    expect(lines.slice(title + 2, title + 2 + BANNER.length)).toStrictEqual(BANNER);
  });
});
