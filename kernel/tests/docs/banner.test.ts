// `docs-site`, v2 banner: until T50 rewrites a page for v3, it opens with the
// banner directly under its title. T50 removes this test with the banners.
import { describe, expect, it } from "vitest";

import { isSnippetPage, readPage, sitePages } from "./site.ts";

const BANNER = [
  '!!! warning "Describes BDK v2"',
  "",
  "    This page describes BDK v2. The v3 documentation replaces it (T50).",
];

const pages = sitePages().filter((page) => !isSnippetPage(readPage(page)));

describe("v2 banner", () => {
  it("covers at least one page", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("%s opens with the banner under its title", (page) => {
    const lines = readPage(page).split("\n");
    const title = lines.findIndex((line) => line.startsWith("# "));
    expect(title, "an H1 title").toBeGreaterThanOrEqual(0);
    expect(lines.slice(title + 2, title + 2 + BANNER.length)).toStrictEqual(BANNER);
  });
});
