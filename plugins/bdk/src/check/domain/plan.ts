// Which commands a check plan holds and how each command line and the line the agent runs are
// composed (ADR-0011).

import { minimatch } from "minimatch";

export const KINDS = ["test", "lint", "build"] as const;
export type Kind = (typeof KINDS)[number];

/** The check points of `--at`; `tools.<kind>.<id>.when` names them (ADR-0008). */
export const POINTS = ["part", "wave", "review"] as const;
export type Point = (typeof POINTS)[number];

/** The marker a command holds where the run's files go. */
const FILES = "{files}";

/** Seconds a command may run when its entry sets no `timeout`. */
export const DEFAULT_TIMEOUT = 600;

/** The Bash tool's cap on one call, in milliseconds, when `BASH_MAX_TIMEOUT_MS` is not set. */
export const DEFAULT_BASH_CAP = 600_000;

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
  /** The picked tests of `--tests`, deduplicated and sorted; null without them. */
  readonly tests?: readonly string[] | null | undefined;
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
 * The checks to plan, in kind order and, inside a kind, in the order the entries resolve, and the
 * entries the run skips. An entry outside the `--at` point is neither. The replacement is a
 * function, so a `$&` or `$'` in a path stays literal.
 */
export function planChecks(tools: Tools, selection: Selection): Plan {
  const { kinds, at, tests = null } = selection;
  const checks: Planned[] = [];
  const skipped: Skipped[] = [];
  for (const kind of KINDS.filter((each) => kinds === undefined || kinds.includes(each))) {
    // A test entry takes the picked tests when there are any, every other entry the run's files.
    const files = kind === "test" && tests !== null ? tests : selection.files;
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

/**
 * The line the agent runs for a planned command: the command as written, stdin closed, both
 * output streams into its output file. It holds no `cd`, variable, quoted text of its own or
 * group, which the permission check of the Bash tool refuses (ADR-0024).
 */
export function lineOf(command: string, output: string): string {
  return `${command} </dev/null > ${quote(output)} 2>&1`;
}

/** The Bash tool's cap from `BASH_MAX_TIMEOUT_MS`; the default when it is unset or not a positive integer. */
export function bashCap(value: string | undefined): number {
  if (value === undefined || !/^[1-9][0-9]*$/.test(value)) return DEFAULT_BASH_CAP;
  return Number(value);
}

/** The timeout of the agent's Bash call, in milliseconds: the command's, at most the cap. */
export function bashTimeout(timeout: number, cap: number): number {
  return Math.min(timeout * 1000, cap);
}

/**
 * True when the command holds a shell list or pipe operator (`&&`, `||`, `;`, `|`) outside
 * quotes, so a redirect after it binds only to its last part.
 */
export function isCompound(command: string): boolean {
  let quote: string | null = null;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (quote !== null) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"') i += 1;
      continue;
    }
    if (char === "\\") i += 1;
    else if (char === "'" || char === '"') quote = char;
    else if (char === ";" || char === "|") return true;
    else if (char === "&" && command[i + 1] === "&") return true;
  }
  return false;
}

/** The notes of a planned command: a timeout above the Bash cap, a compound command. */
export function notesOf(command: string, timeout: number, cap: number): readonly string[] {
  const notes: string[] = [];
  if (timeout * 1000 > cap) {
    notes.push(
      `its timeout of ${String(timeout)} s exceeds the Bash cap of ${String(cap / 1000)} s; set env.BASH_MAX_TIMEOUT_MS to "${String(timeout * 1000)}" in .claude/settings.json`,
    );
  }
  if (isCompound(command)) {
    notes.push(
      "it holds a shell list or pipe, so only its last part writes to the output file; a project script keeps the command whole",
    );
  }
  return notes;
}
