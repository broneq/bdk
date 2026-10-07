import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sidebarItems } from "./sidebar.ts";

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
