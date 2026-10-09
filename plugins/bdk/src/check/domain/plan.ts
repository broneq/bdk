// Which commands a check run runs and how each command line is composed (spec `bdk-cli/check`,
// "Run the checks"; design D4 of v3-183-check-run, D1-D4 of v3-275-scoped-check-files).

import { minimatch } from "minimatch";

export const KINDS = ["test", "lint", "build"] as const;
export type Kind = (typeof KINDS)[number];

/** Seconds a command may run when its entry sets no `timeout`. */
export const DEFAULT_TIMEOUT = 600;

/** A `tools.<kind>` item of the resolved configuration. */
export interface Entry {
  readonly id: string;
  readonly command: string;
  readonly scoped?: string | undefined;
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

/** An entry a scoped run leaves out because its `paths` match no scope path. */
export interface Skipped {
  readonly kind: Kind;
  readonly tool: string;
}

export interface Plan {
  readonly checks: readonly Planned[];
  readonly skipped: readonly Skipped[];
}

const PLAIN = /^[A-Za-z0-9_./@%+=:,-]+$/;

/** The scope paths deduplicated and sorted by code unit; null without paths. */
export function scopeOf(paths: readonly string[] | undefined): readonly string[] | null {
  if (paths === undefined || paths.length === 0) return null;
  return [...new Set(paths)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** A path as one word of a POSIX shell command line. */
export function quote(path: string): string {
  return PLAIN.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`;
}

/** The scope paths an entry's `paths` match, matched as rule paths match files; all without `paths`. */
function filesOf(entry: Entry, scope: readonly string[]): readonly string[] {
  const { paths } = entry;
  if (paths === undefined) return scope;
  return scope.filter((path) => {
    const file = path.startsWith("./") ? path.slice(2) : path;
    return paths.some((glob) => minimatch(file, glob, { dot: true }));
  });
}

/**
 * The checks to run, in kind order and, inside a kind, in the order the entries resolve, and the
 * entries a scoped run skips. The replacement is a function, so a `$&` or `$'` in a path stays
 * literal.
 */
export function planChecks(
  tools: Tools,
  kinds: readonly Kind[] | undefined,
  scope: readonly string[] | null,
): Plan {
  const checks: Planned[] = [];
  const skipped: Skipped[] = [];
  for (const kind of KINDS.filter((each) => kinds === undefined || kinds.includes(each))) {
    for (const entry of tools[kind]) {
      const files = scope === null ? null : filesOf(entry, scope);
      if (files?.length === 0) {
        skipped.push({ kind, tool: entry.id });
        continue;
      }
      const words = files?.map(quote).join(" ");
      const variant =
        words === undefined ? undefined : entry.scoped?.replaceAll("{files}", () => words);
      checks.push({
        kind,
        tool: entry.id,
        command: variant ?? entry.command,
        scoped: variant !== undefined,
        timeout: entry.timeout ?? DEFAULT_TIMEOUT,
      });
    }
  }
  return { checks, skipped };
}
