import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { declaredItems, sidebar, sidebarItems, unlistedPages, USER_SECTIONS } from "./sidebar.ts";

function docsDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "bdk-sidebar-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("sidebarItems", () => {
  it("lists the Markdown files of a directory in file-name order, titled by their first heading", () => {
    const root = docsDir({
      "adr/0002-second.md": "---\nstatus: accepted\n---\n\n# ADR-0002: Second\n\n## Context\n",
      "adr/0001-first.md": "# ADR-0001: First\n\nText with # a hash.\n",
      "adr/notes.txt": "# Not a page\n",
      "design/2026-01-01-other.md": "# Other\n",
    });

    expect(sidebarItems(root, "adr")).toEqual([
      { text: "ADR-0001: First", link: "/adr/0001-first" },
      { text: "ADR-0002: Second", link: "/adr/0002-second" },
    ]);
  });

  it("titles an entry by the plain text of its heading before ' - '", () => {
    const root = docsDir({
      "adr/0003-long.md": "# ADR-0003: Builds on a `release` branch - one writer - of run state\n",
    });

    expect(sidebarItems(root, "adr")).toEqual([
      { text: "ADR-0003: Builds on a release branch", link: "/adr/0003-long" },
    ]);
  });

  it("fails with the file path when a file has no level-one heading", () => {
    const root = docsDir({ "design/untitled.md": "## Only a subheading\n" });

    expect(() => sidebarItems(root, "design")).toThrow(
      `${join(root, "design", "untitled.md")} has no "# " heading`,
    );
  });

  it("titles every ADR and design of this site", () => {
    const root = import.meta.dirname + "/..";

    expect(sidebarItems(root, "adr").map((item) => item.link)).toContain(
      "/adr/0002-v3-repo-structure-and-release",
    );
    expect(sidebarItems(root, "design").map((item) => item.link)).toContain(
      "/design/2026-10-07-v3-architecture",
    );
  });
});

describe("user sections", () => {
  const sections = [{ text: "Concepts", dir: "concepts", pages: ["index", "b"] }];

  it("lists a section in its declared order, the index as the section root", () => {
    const root = docsDir({
      "concepts/b.md": "# B - second\n",
      "concepts/index.md": "# Concepts - start\n",
    });

    expect(
      declaredItems(root, { text: "Concepts", dir: "concepts", pages: ["index", "b"] }),
    ).toEqual([
      { text: "Concepts", link: "/concepts/" },
      { text: "B", link: "/concepts/b" },
    ]);
  });

  it("names a page missing from the sidebar and a sidebar page without a file", () => {
    const root = docsDir({
      "concepts/index.md": "# Concepts\n",
      "concepts/extra.md": "# Extra\n",
      "concepts/deep/page.md": "# Deep\n",
    });

    expect(unlistedPages(root, sections)).toEqual([
      "docs/concepts/deep/page.md is not in the Concepts sidebar",
      "docs/concepts/extra.md is not in the Concepts sidebar",
      "the Concepts sidebar lists docs/concepts/b.md, which does not exist",
    ]);
  });

  it("lists every Guide, Concepts and Reference page of this site, and only those", () => {
    expect(unlistedPages(import.meta.dirname + "/..", USER_SECTIONS)).toEqual([]);
  });

  it("orders the sections Guide, Concepts, Reference, decisions, designs", () => {
    expect(sidebar(import.meta.dirname + "/..").map((section) => section.text)).toEqual([
      "Guide",
      "Concepts",
      "Reference",
      "Architecture decisions",
      "Designs",
    ]);
  });
});
