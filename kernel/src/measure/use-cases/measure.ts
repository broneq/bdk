// `bdk measure [<range>]`: validates the range, then reads `git diff
// --numstat -z` with rename detection and without external diff drivers,
// so the output depends on the repository state only, not on git config.
import type { Git } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { aggregate, fileStats, parseRange } from "../domain/measure.ts";
import type { FileStat, MeasureReport } from "../domain/measure.ts";

export interface MeasureDeps {
  readonly git: Git;
}

const DEFAULT_RANGE = "HEAD";

export async function measure(
  deps: MeasureDeps,
  workTree: string,
  range: string = DEFAULT_RANGE,
): Promise<MeasureReport | Refusal> {
  const refs = parseRange(range);
  if (refs === undefined) {
    return refuse(
      "input/invalid-argument",
      `${JSON.stringify(range)} is not <base> or <base>..<head>`,
      ["bdk measure main", "bdk measure main..HEAD"],
    );
  }
  for (const ref of refs) {
    const found = await deps.git.run(
      ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
      workTree,
    );
    if (found.code !== 0) {
      return refuse("input/invalid-argument", `${ref} names no commit in ${workTree}`, [
        "git branch --list",
        "bdk measure HEAD",
      ]);
    }
  }
  return diffSignals(deps, workTree, range, refs.join(".."));
}

/** The per-file lines of `<base>..<head>`, sorted by path (`kernel-cli/review`, bdk review render). */
export async function rangeFiles(
  deps: MeasureDeps,
  workTree: string,
  base: string,
  head: string,
): Promise<FileStat[] | Refusal> {
  const range = `${base}..${head}`;
  const output = await numstat(deps, workTree, range, range);
  return typeof output === "string" ? fileStats(output) : output;
}

export interface RangeStats {
  readonly files: readonly FileStat[];
  readonly report: MeasureReport;
}

/**
 * The per-file rows of `<base>..<head>`, binary files flagged, and their
 * signals, from one `git diff` (`kernel-cli/review`, bdk review plan, #158).
 */
export async function rangeStats(
  deps: MeasureDeps,
  workTree: string,
  base: string,
  head: string,
): Promise<RangeStats | Refusal> {
  const range = `${base}..${head}`;
  const output = await numstat(deps, workTree, range, range);
  if (typeof output !== "string") return output;
  const files = fileStats(output);
  return { files, report: aggregate(range, files) };
}

async function diffSignals(
  deps: MeasureDeps,
  workTree: string,
  range: string,
  revisions: string,
): Promise<MeasureReport | Refusal> {
  const output = await numstat(deps, workTree, range, revisions);
  return typeof output === "string" ? aggregate(range, fileStats(output)) : output;
}

async function numstat(
  deps: MeasureDeps,
  workTree: string,
  range: string,
  revisions: string,
): Promise<string | Refusal> {
  const diff = await deps.git.run(
    [
      "diff",
      "--numstat",
      "-z",
      "--find-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      revisions,
      "--",
    ],
    workTree,
  );
  if (diff.code !== 0) {
    return refuse("input/invalid-argument", `git diff ${range} failed: ${diff.stderr.trim()}`, [
      "bdk measure HEAD",
    ]);
  }
  return diff.stdout;
}
