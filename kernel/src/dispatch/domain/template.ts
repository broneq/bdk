// The one package template (`kernel-cli/dispatch`, bdk dispatch build;
// T23-D11, not overridable): the sections in their fixed order, each a
// skeleton with `{{name}}` placeholders. The skeletons are what
// `template-hash` covers of the template (T23-D33), so a new wording is a
// new hash.

/** A section a package carries only when the build names its kind. */
export type SectionKind =
  "verifier" | "runner" | "lead" | "review" | "risks" | "work-root" | "conflict" | "merge";

interface Section {
  readonly name: string;
  readonly skeleton: string;
  /**
   * Only packages of this kind carry it: the verifiers' P8 lists, the runner's
   * checks, the lead's tasks, a grouped package's review scope (T42-A1) and the
   * integration reviewer's risks (T42-K), a worktree target's work root and a
   * merge ticket's conflict for its implementer and the merge note for its steps (T45).
   */
  readonly only?: SectionKind;
}

const SECTIONS: readonly Section[] = [
  {
    name: "header",
    skeleton:
      "# BDK dispatch package {{ticket}}\n\nYou are the `{{role}}` of ticket {{ticket}}: attempt {{attempt}} of {{of}}, scope `{{scope}}`. Work from this package; read other state only through `bdk`.",
  },
  { name: "change", skeleton: "## Change\n\n{{intent}}" },
  { name: "target", skeleton: "## Target {{target}}\n\n{{target-body}}" },
  {
    name: "work-root",
    only: "work-root",
    skeleton:
      "## Work root\n\nYour work root is `{{workdir}}`, the worktree of part {{part}}. Every file you read or edit and every command you run, the checks included, is inside it: start each shell command with `cd {{workdir}} && `, and give each file tool an absolute path under it. The plan, the ledger and this package stay in the home checkout; reach them only through `bdk`. `hooks pre-tool` denies a file edit outside the work root (`guard/worktree-scope`).",
  },
  {
    name: "conflict",
    only: "conflict",
    skeleton:
      "## Conflict\n\nThe kernel merged `{{merged}}` into the work root, and git reports these paths unmerged:\n\n{{conflicts}}\n\nEdit only these paths, following the instruction below. Run no git command: the kernel stages and commits the merge at `bdk attempt close`. Return `blocked`, naming the paths, for a conflict the instruction does not settle.\n\n{{merge-instruction}}",
  },
  {
    name: "merge",
    only: "merge",
    skeleton:
      "## Merge\n\nThe kernel merged `{{merged}}` into the work root, the implementer resolved the conflicts, and the kernel commits the merge at `bdk attempt close`: until then a merge in progress and unmerged paths are expected; do not report them.",
  },
  {
    name: "tasks",
    only: "lead",
    skeleton:
      "## Tasks\n\nThe tasks of the part in plan order. A committed task is done; start the others as their dependencies are committed.\n\n{{tasks}}",
  },
  {
    name: "review",
    only: "review",
    skeleton:
      "## Review\n\nYou review group `{{group}}` of ticket {{ticket}}. Review only this group; another agent reviews each other group in parallel.\n\n{{review}}",
  },
  { name: "entries", skeleton: "## Ledger entries\n\n{{entries}}" },
  { name: "role", skeleton: "{{role-body}}" },
  {
    name: "rules",
    skeleton:
      "## Rules\n\nRun `bdk rules show --ticket {{ref}}` before you start and follow the rules it prints.",
  },
  {
    name: "categories",
    only: "verifier",
    skeleton:
      "## Blocking categories (P8)\n\nA blocker names one of these with `bdk log add blocker <summary> --ref <ref> --ticket {{ref}} --category <id>`; any other blocker is stored as an observation for review.\n\n{{blocking}}\n\n## Not a fail\n\nNever block on these:\n\n{{not-a-fail}}",
  },
  {
    name: "risks",
    only: "risks",
    skeleton:
      "## Risks\n\nThe project's risky areas. Call out every change in the range that touches one, with a finding naming the risk id.\n\n{{risks}}",
  },
  { name: "checks", only: "runner", skeleton: "## Checks\n\n{{checks}}" },
  {
    name: "return",
    skeleton:
      "## Return\n\nWrite your entries with `bdk log add <type> <summary> --ref <ref> --ticket {{ref}}`: the summary is 1 to 120 characters (put detail in `--body`), the type is one of decision, finding, observation, blocker, question, assumption, risk, learning, report. Then pipe the full report to `bdk log ingest --ticket {{ref}}` on stdin (`bdk log ingest --ticket {{ref}} < <report-file>`; there is no frontmatter flag), the envelope (`status`, `files`, `entries`, `evidence`) as its frontmatter between two `---` lines. `entries` lists the ids `log add` printed. Leave `reason` out, except for `blocked` or `needs-context`. When it refuses, fix the named field and call it again. Return only the envelope and the report path `{{report}}`.",
  },
];

export interface RenderedSection {
  readonly name: string;
  readonly text: string;
}

/** The sections a package of these kinds carries, placeholders filled; a missing value throws. */
export function renderSections(
  values: Readonly<Record<string, string>>,
  kinds: readonly SectionKind[],
): RenderedSection[] {
  return SECTIONS.filter(
    (section) => section.only === undefined || kinds.includes(section.only),
  ).map((section) => ({
    name: section.name,
    text: section.skeleton.replace(/\{\{([a-z-]+)\}\}/g, (_, name: string) => {
      const value = values[name];
      if (value === undefined) throw new Error(`the package template has no value for ${name}`);
      return value;
    }),
  }));
}

export function packageBody(sections: readonly RenderedSection[]): string {
  return `${sections.map((section) => section.text.trimEnd()).join("\n\n")}\n`;
}

/** The skeleton `template-hash` covers: every section, the role-only ones included. */
export function templateSkeleton(): string {
  return SECTIONS.map((section) => section.skeleton).join("\n\n");
}

/** LF line ends, no trailing whitespace, no frontmatter (T23-D33). */
export function normalise(text: string): string {
  const lf = text.replace(/\r\n?/g, "\n");
  const body = /^---\n(?:.*\n)*?---(?:\n|$)/.exec(lf);
  const rest = body === null ? lf : lf.slice(body[0].length);
  return rest
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** The largest section and its bytes, for `policy/package-too-large`. */
export function largestSection(sections: readonly RenderedSection[]): RenderedSection {
  let largest = sections[0];
  if (largest === undefined) throw new Error("a package has sections");
  for (const section of sections) {
    if (bytes(section.text) > bytes(largest.text)) largest = section;
  }
  return largest;
}

export function bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** The role body one heading level down, so its `# Role: <role>` sits beside the package sections. */
export function demoteHeadings(markdown: string): string {
  let fence: string | undefined;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker !== undefined) {
        if (fence === undefined) fence = marker;
        else if (marker.startsWith(fence)) fence = undefined;
        return line;
      }
      return fence === undefined && /^#{1,5} /.test(line) ? `#${line}` : line;
    })
    .join("\n");
}
