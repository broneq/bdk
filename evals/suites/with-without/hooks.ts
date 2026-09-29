// The with / without measurement (design D-9), loaded by the harness's
// extension hook after every run: the task's assertions, turns and wall time;
// cost is the row's own field.
import type { EvalResult, Measurement, SuiteHooks } from "../../harness/hook.ts";

export function measure(result: EvalResult): Measurement {
  const grading = result.gradingResult ?? null;
  const metadata = result.response?.metadata;
  return {
    metrics: {
      assert_pass: grading === null ? null : grading.pass ? 1 : 0,
      assert_score: grading === null ? null : grading.score,
      turns: metadata?.numTurns ?? null,
      wall_s: metadata?.durationMs === undefined ? null : metadata.durationMs / 1000,
    },
    extraCost: 0,
    templateHashes: [],
  };
}

export const hooks: SuiteHooks = {
  measure: (_context, result) => Promise.resolve(measure(result)),
};
