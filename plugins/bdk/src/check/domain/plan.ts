// Which commands a check run runs and how each command line is composed (spec `bdk-cli/check`,
// "Run the checks"; design D4 of v3-183-check-run, D1-D4 of v3-275-scoped-check-files, D1-D4 of
// v3-317-test-groups).

import { minimatch } from "minimatch";

export const KINDS = ["test", "lint", "build"] as const;
export type Kind = (typeof KINDS)[number];

/** The check points of `--at`; `tools.<kind>.<id>.when` names them (spec `bdk-cli/config`). */
export const POINTS = ["part", "wave", "review"] as const;
export type Point = (typeof POINTS)[number];

/** The marker a command holds where the run's files go. */
const FILES = "{files}";

/** Seconds a command may run when its entry sets no `timeout`. */
export const DEFAULT_TIMEOUT = 600;

/** A `tools.<kind>` item of the resolved configuration. */
export interface Entry {
  readonly id: string;
  readonly command: string;
  readonly when?: readonly Point[] | undefined;
  readonly timeout?: number | undefined;
  readonly paths?: readonly string[] | undefined;
}

export type Tools = Readonly<Record<Kind, readonly Entry[]>>;

export interface Planned {
  readonly kind: Kind;
  readonly tool: string;
  readonly command: string;
  readonly scoped: boolean;
  readonly timeout: number;
}

/**
 * An entry the run leaves out: `paths` when the run has files and none is the entry's,
 * `no-files` when its command holds `{files}` and the run has no files.
 */
export interface Skipped {
  readonly kind: Kind;
  readonly tool: string;
  readonly reason: "paths" | "no-files";
}

export interface Selection {
  readonly kinds?: readonly Kind[] | undefined;
  readonly at?: Point | undefined;
  /** The run's files, deduplicated and sorted; null when the run has none. */
  readonly files: readonly string[] | null;
}

export interface Plan {
  readonly checks: readonly Planned[];
  readonly skipped: readonly Skipped[];
}

const PLAIN = /^[A-Za-z0-9_./@%+=:,-]+$/;

/** The paths deduplicated and sorted by code unit; null without paths. */
export function scopeOf(paths: readonly string[] | undefined): readonly string[] | null {
  if (paths === undefined || paths.length === 0) return null;
  return [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** A path as one word of a POSIX shell command line. */
export function quote(path: string): string {
  return PLAIN.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`;
}

/** The NUL-separated paths of a `git ... -z` listing. */
export function nulPaths(text: string): readonly string[] {
  return text.split("\0").filter((path) => path !== "");
}

/** The run's files an entry's `paths` match, matched as rule paths match files; all without `paths`. */
function filesOf(entry: Entry, files: readonly string[]): readonly string[] {
  const { paths } = entry;
  if (paths === undefined) return files;
  return files.filter((path) => {
    const file = path.startsWith("./") ? path.slice(2) : path;
    return paths.some((glob) => minimatch(file, glob, { dot: true }));
  });
}

/**
 * The checks to run, in kind order and, inside a kind, in the order the entries resolve, and the
 * entries the run skips. An entry outside the `--at` point is neither. The replacement is a
 * function, so a `$&` or `$'` in a path stays literal.
 */
export function planChecks(tools: Tools, selection: Selection): Plan {
  const { kinds, at, files } = selection;
  const checks: Planned[] = [];
  const skipped: Skipped[] = [];
  for (const kind of KINDS.filter((each) => kinds === undefined || kinds.includes(each))) {
    for (const entry of tools[kind]) {
      if (at !== undefined && entry.when !== undefined && !entry.when.includes(at)) continue;
      const scoped = entry.command.includes(FILES);
      if (files === null) {
        if (scoped) skipped.push({ kind, tool: entry.id, reason: "no-files" });
        else checks.push(planned(kind, entry, entry.command, false));
        continue;
      }
      const own = filesOf(entry, files);
      if (own.length === 0 && (scoped || entry.paths !== undefined)) {
        skipped.push({ kind, tool: entry.id, reason: "paths" });
        continue;
      }
      const words = own.map(quote).join(" ");
      const command = scoped ? entry.command.replaceAll(FILES, () => words) : entry.command;
      checks.push(planned(kind, entry, command, scoped));
    }
  }
  return { checks, skipped };
}

function planned(kind: Kind, entry: Entry, command: string, scoped: boolean): Planned {
  return { kind, tool: entry.id, command, scoped, timeout: entry.timeout ?? DEFAULT_TIMEOUT };
}
