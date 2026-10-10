import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SidebarLink {
  text: string;
  link: string;
}

export interface SidebarSection {
  text: string;
  items: SidebarLink[];
}

/** A user section of the site: its directory and its pages in reading order. */
export interface UserSection {
  readonly text: string;
  readonly dir: string;
  /** Page paths under `dir` without `.md`; `index` is the section's landing page. */
  readonly pages: readonly string[];
}

/**
 * The Guide, Concepts and Reference sections in reading order. Their order is a choice, so it is
 * declared here; `unlistedPages` fails `pnpm check` when a page and this list disagree.
 */
export const USER_SECTIONS: readonly UserSection[] = [
  {
    text: "Guide",
    dir: "guide",
    pages: [
      "index",
      "install",
      "first-run",
      "workflow",
      "configuration",
      "footprint",
      "diagnostics",
      "explain",
    ],
  },
  {
    text: "Concepts",
    dir: "concepts",
    pages: [
      "workflow",
      "stages",
      "openspec-changes",
      "orchestrators",
      "agents",
      "run-state",
      "findings",
      "gates-and-budgets",
      "e2e",
      "rules",
      "cli-config-hooks",
      "glossary",
    ],
  },
  {
    text: "Reference",
    dir: "reference",
    pages: [
      "index",
      "bdk/skills",
      "bdk/agents",
      "bdk/cli",
      "bdk/settings",
      "bdk/rules",
      "bdk/hooks",
      "bdk-craft",
      "bdk-explain",
      "bdk-skill-kit",
      "git-identity",
    ],
  },
];

/** The plain text of a page's first level-one heading, up to its first " - ". */
function titleOf(path: string): string {
  const heading = /^# (.+)$/m.exec(readFileSync(path, "utf8"))?.[1];
  // Headings read "<title> - <summary>"; the sidebar shows the title, as plain text.
  const title = heading?.split(" - ")[0]?.replaceAll("`", "").trim();
  if (!title) {
    throw new Error(`${path} has no "# " heading to title its sidebar entry`);
  }
  return title;
}

/**
 * Sidebar entries for every Markdown file in `docs/<section>/`, in file-name order, so a new
 * ADR or design appears on the site without a config change. ADR and design file names start
 * with a number or a date, so file-name order is chronological.
 */
export function sidebarItems(docsDir: string, section: string): SidebarLink[] {
  return readdirSync(join(docsDir, section))
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => ({
      text: titleOf(join(docsDir, section, file)),
      link: `/${section}/${file.slice(0, -".md".length)}`,
    }));
}

/** Sidebar entries for a user section, in its declared order. */
export function declaredItems(docsDir: string, section: UserSection): SidebarLink[] {
  return section.pages.map((page) => ({
    text: titleOf(join(docsDir, section.dir, `${page}.md`)),
    link: page === "index" ? `/${section.dir}/` : `/${section.dir}/${page}`,
  }));
}

/** The whole sidebar: the user sections, then every ADR and every design. */
export function sidebar(docsDir: string): SidebarSection[] {
  return [
    ...USER_SECTIONS.map((section) => ({
      text: section.text,
      items: declaredItems(docsDir, section),
    })),
    { text: "Architecture decisions", items: sidebarItems(docsDir, "adr") },
    { text: "Designs", items: sidebarItems(docsDir, "design") },
  ];
}

/**
 * Problems between the user sections and the files: a Markdown page under a section's
 * directory that the section does not list, and a listed page without a file.
 */
export function unlistedPages(docsDir: string, sections: readonly UserSection[]): string[] {
  return sections.flatMap((section) => {
    let files: string[];
    try {
      files = readdirSync(join(docsDir, section.dir), { recursive: true, encoding: "utf8" })
        .filter((file) => file.endsWith(".md"))
        .map((file) => file.split("\\").join("/").slice(0, -".md".length));
    } catch {
      files = [];
    }
    const listed = new Set(section.pages);
    const onDisk = new Set(files);
    return [
      ...files
        .filter((page) => !listed.has(page))
        .map((page) => `docs/${section.dir}/${page}.md is not in the ${section.text} sidebar`),
      ...section.pages
        .filter((page) => !onDisk.has(page))
        .map(
          (page) =>
            `the ${section.text} sidebar lists docs/${section.dir}/${page}.md, which does not exist`,
        ),
    ].sort();
  });
}
