// One plan part as `bdk plan check` reads it (spec `bdk-cli/plan`, "Part files", "Part limits";
// design D2, D8): the frontmatter of `bdk-openspec-schema` checked key by key, and the measures
// the part limits apply to. Faults are values, so one call reports every fault of a plan.

import { parse } from "yaml";

export const ISOLATIONS = ["worktree", "shared"] as const;
export type Isolation = (typeof ISOLATIONS)[number];

export interface Part {
  /** The file stem, `01` for `01.md`. */
  readonly id: string;
  /** Null when `isolation` is missing or invalid. */
  readonly isolation: Isolation | null;
  /** Empty when `depends-on` is missing or invalid. */
  readonly dependsOn: readonly string[];
  /** The distinct paths of `files`, in their first order; empty when `files` is invalid. */
  readonly files: readonly string[];
  readonly tasks: number;
  readonly bytes: number;
  /** What breaks the frontmatter rules, one sentence per key. */
  readonly faults: readonly string[];
}

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

/** The numbered list items under `## Tasks`, up to the next `#` or `##` heading. */
export function countTasks(text: string): number {
  let inTasks = false;
  let fence: string | undefined;
  let count = 0;
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
      if (level <= 2) inTasks = level === 2 && heading[2] === "Tasks";
      continue;
    }
    if (inTasks && /^\d+[.)] /.test(line)) count += 1;
  }
  return count;
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
  };
  const found = frontmatter(text.split(/\r?\n/));
  if ("fault" in found) {
    return { ...measures, isolation: null, dependsOn: [], files: [], faults: [found.fault] };
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

  const isolation = ISOLATIONS.find((name) => name === data.isolation) ?? null;
  if (isolation === null) {
    const was =
      data.isolation === undefined
        ? "missing"
        : typeof data.isolation === "string"
          ? data.isolation
          : JSON.stringify(data.isolation);
    faults.push(`isolation is ${was}, not worktree or shared`);
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
    isolation,
    dependsOn: isStrings(deps) ? [...new Set(deps)] : [],
    files,
    faults,
  };
}
