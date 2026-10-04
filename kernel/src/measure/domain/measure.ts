// Diff signals from `git diff --numstat -z` (`kernel-cli/change`, bdk
// measure; design D-11 of T20). Signals only, never a class: each consumer
// applies its own thresholds. Pure, so the same input gives the same output.

export interface MeasureReport {
  readonly range: string;
  readonly files: number;
  readonly added: number;
  readonly removed: number;
  readonly lines: number;
  readonly modules: readonly string[];
}

export interface FileStat {
  readonly path: string;
  readonly added: number;
  readonly removed: number;
}

/**
 * Parses `--numstat -z` output: `<added>\t<removed>\t<path>\0` per file, or
 * `<added>\t<removed>\t\0<old>\0<new>\0` for a rename, counted under the new
 * path. A binary file reports `-` for both counts and counts zero lines.
 */
function parseNumstat(output: string): FileStat[] {
  const tokens = output.split("\0");
  const stats: FileStat[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const match = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(tokens[i] ?? "");
    if (match === null) continue;
    let path = match[3] ?? "";
    if (path === "") {
      path = tokens[i + 2] ?? "";
      i += 2;
    }
    const count = (value: string | undefined): number => (value === "-" ? 0 : Number(value));
    stats.push({ path, added: count(match[1]), removed: count(match[2]) });
  }
  return stats;
}

/** The first two directory segments, the file name alone for a root file. */
export function moduleOf(path: string): string {
  const segments = path.split("/");
  if (segments.length === 1) return path;
  return segments.slice(0, Math.min(2, segments.length - 1)).join("/");
}

/** Ledger and machine files never count: any path with a `.bdk` segment. */
function isBdk(path: string): boolean {
  return path.split("/").includes(".bdk");
}

/** The changed files outside `.bdk/` with their lines, sorted by path. */
export function fileStats(output: string): FileStat[] {
  return parseNumstat(output)
    .filter((stat) => !isBdk(stat.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function aggregate(range: string, output: string): MeasureReport {
  const stats = fileStats(output);
  const added = stats.reduce((sum, stat) => sum + stat.added, 0);
  const removed = stats.reduce((sum, stat) => sum + stat.removed, 0);
  const modules = [...new Set(stats.map((stat) => moduleOf(stat.path)))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return {
    range,
    files: new Set(stats.map((stat) => stat.path)).size,
    added,
    removed,
    lines: added + removed,
    modules,
  };
}

/** `<base>` or `<base>..<head>`; undefined for anything else. */
export function parseRange(
  range: string,
): readonly [string] | readonly [string, string] | undefined {
  const parts = range.split("..");
  if (parts.length > 2 || parts.some((part) => !isRefName(part))) return undefined;
  return parts.length === 1 ? [parts[0] ?? ""] : [parts[0] ?? "", parts[1] ?? ""];
}

/**
 * A revision git could accept (`main`, `origin/main`, `HEAD~2`), never an
 * option: no leading `-`, no whitespace or control characters, and no path
 * component starting with `.` (which also rejects `a...b`).
 */
function isRefName(value: string): boolean {
  return (
    value !== "" &&
    !value.startsWith("-") &&
    !/[\s\p{Cc}]/u.test(value) &&
    !value.split("/").some((part) => part.startsWith("."))
  );
}
