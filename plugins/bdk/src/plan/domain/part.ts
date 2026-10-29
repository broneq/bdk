// One plan part as `bdk plan check` reads it (`docs/concepts/stages.md`; design D2, D8): the
// frontmatter of the BDK OpenSpec schema checked key by key, the measures the part limits apply to,
// and the scenarios and `Verified by:` lines the present-scenario check reads. Faults are values,
// so one call reports every fault of a plan.

import { parse } from "yaml";

export interface Part {
  /** The file stem, `01` for `01.md`. */
  readonly id: string;
  /** Empty when `depends-on` is missing or invalid. */
  readonly dependsOn: readonly string[];
  /** The distinct paths of `files`, in their first order; empty when `files` is invalid. */
  readonly files: readonly string[];
  readonly tasks: number;
  readonly bytes: number;
  /** The scenarios under `## Acceptance scenarios`, in their order. */
  readonly scenarios: readonly Scenario[];
  /** The text after `Verified by:` of every such line under `## Tasks`, in their order. */
  readonly verifiedBy: readonly string[];
  /** What breaks the frontmatter rules, one sentence per key. */
  readonly faults: readonly string[];
}

export interface Scenario {
  /** The text after the last `Scenario: `, without the marker. */
  readonly name: string;
  /** True when the line ends with the marker ` (behaviour present)`. */
  readonly present: boolean;
}

export const PRESENT_MARKER = " (behaviour present)";

/** The part id of a file name, or undefined when the file is no part. */
export function partId(name: string): string | undefined {
  return /^(\d{2})\.md$/.exec(name)?.[1];
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Why `path` is not an exact repository-relative file path, or undefined when it is one. */
function pathFault(path: string): string | undefined {
  if (path === "") return "an empty path";
  if (/[*?]/.test(path)) return "a glob, not a file path";
  if (path.endsWith("/")) return "a directory, not a file path";
  if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)) {
    return "an absolute path, not a repository-relative one";
  }
  if (path.split(/[\\/]/).includes("..")) return "a path with a .. segment";
  return undefined;
}

function show(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value);
}

/**
 * The lines of the level-2 section `title`, up to the next `#` or `##` heading, outside fenced
 * code blocks and without the deeper headings.
 */
function sectionLines(text: string, title: string): string[] {
  let inSection = false;
  let fence: string | undefined;
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker !== undefined) {
      if (fence === undefined) fence = marker;
      else if (marker.startsWith(fence)) fence = undefined;
      continue;
    }
    if (fence !== undefined) continue;
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      if (level <= 2) inSection = level === 2 && heading[2] === title;
      continue;
    }
    if (inSection) lines.push(line);
  }
  return lines;
}

/** The numbered list items under `## Tasks`, up to the next `#` or `##` heading. */
export function countTasks(text: string): number {
  return sectionLines(text, "Tasks").filter((line) => /^\d+[.)] /.test(line)).length;
}

/** The list items under `## Acceptance scenarios` that name a `Scenario: `. */
export function readScenarios(text: string): Scenario[] {
  const scenarios: Scenario[] = [];
  for (const line of sectionLines(text, "Acceptance scenarios")) {
    const item = /^\s*[-*+]\s+(.*?)\s*$/.exec(line)?.[1];
    const at = item?.lastIndexOf("Scenario: ") ?? -1;
    if (item === undefined || at === -1) continue;
    const named = item.slice(at + "Scenario: ".length);
    const present = named.endsWith(PRESENT_MARKER);
    const name = (present ? named.slice(0, -PRESENT_MARKER.length) : named).trim();
    if (name !== "") scenarios.push({ name, present });
  }
  return scenarios;
}

/** The text after `Verified by:` of every list item under `## Tasks` that starts with it. */
export function readVerifiedBy(text: string): string[] {
  return sectionLines(text, "Tasks").flatMap((line) => {
    const rest = /^\s*[-*+]\s+Verified by:\s*(.*?)\s*$/.exec(line)?.[1];
    return rest === undefined ? [] : [rest];
  });
}

type Frontmatter = { readonly data: Record<string, unknown> } | { readonly fault: string };

function frontmatter(lines: readonly string[]): Frontmatter {
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end === -1) return { fault: "has no frontmatter between --- lines" };
  let data: unknown;
  try {
    data = parse(lines.slice(1, end).join("\n"));
  } catch (error) {
    const first = (error as Error).message.split("\n")[0] ?? "";
    return { fault: `frontmatter is not YAML: ${first}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { fault: "frontmatter is not a mapping" };
  }
  return { data: data as Record<string, unknown> };
}

/** Reads part `id` from the text of its file. */
export function readPart(id: string, text: string): Part {
  const measures = {
    id,
    tasks: countTasks(text),
    bytes: new TextEncoder().encode(text).length,
    scenarios: readScenarios(text),
    verifiedBy: readVerifiedBy(text),
  };
  const found = frontmatter(text.split(/\r?\n/));
  if ("fault" in found) {
    return { ...measures, dependsOn: [], files: [], faults: [found.fault] };
  }
  const { data } = found;
  const faults: string[] = [];

  if (data.id !== id) {
    const was = data.id === undefined ? "missing" : show(data.id);
    faults.push(`id is ${was}, not the quoted file stem "${id}"`);
  }

  const deps = data["depends-on"];
  if (deps === undefined) faults.push("depends-on is missing; use [] for none");
  else if (!isStrings(deps)) faults.push("depends-on is not a list of quoted part ids");

  // A plan written for parallel worktrees must not pass and keep telling its reader so.
  if ("isolation" in data) {
    faults.push(
      "isolation is no longer a part key: parts run one after another in the main checkout; remove it",
    );
  }

  const listed = data.files;
  let files: string[] = [];
  if (listed === undefined) faults.push("files is missing");
  else if (!isStrings(listed)) faults.push("files is not a list of paths");
  else if (listed.length === 0) faults.push("files is empty");
  else {
    files = [...new Set(listed)];
    for (const path of files) {
      const fault = pathFault(path);
      if (fault !== undefined) faults.push(`files holds ${path}, ${fault}`);
    }
  }

  return {
    ...measures,
    dependsOn: isStrings(deps) ? [...new Set(deps)] : [],
    files,
    faults,
  };
}
