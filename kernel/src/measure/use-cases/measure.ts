// `bdk measure [<range>]`: validates the range, then reads `git diff
// --numstat -z` with rename detection and without external diff drivers,
// so the output depends on the repository state only, not on git config.
import type { Git } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { aggregate, parseRange } from "../domain/measure.ts";
import type { MeasureReport } from "../domain/measure.ts";

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
  const diff = await deps.git.run(
    [
      "diff",
      "--numstat",
      "-z",
      "--find-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      refs.join(".."),
      "--",
    ],
    workTree,
  );
  if (diff.code !== 0) {
    return refuse("input/invalid-argument", `git diff ${range} failed: ${diff.stderr.trim()}`, [
      "bdk measure HEAD",
    ]);
  }
  return aggregate(range, diff.stdout);
}
