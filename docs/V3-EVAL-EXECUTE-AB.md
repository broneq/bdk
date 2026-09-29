# V3 eval: execute A/B

T40 (issue #60) measures whether a thin execute skill, one that loops `bdk next` and takes the order of steps from the kernel, does its job as well as a long skill that writes the order out (approach B). The outcome decides how T41 writes the stage skills. This report is filled in after the measured series; only the criterion below exists before the first measured run, and it is committed first so that the rows cannot shape it.

## Setup

- Task: CSV export of the operator audit page in the fixture repository `kamkie/technical-interview-frontend` at `946a2081f84381ffc3b4a494467479a5b6886ead`; two plan parts, four test-first tasks (`evals/suites/execute-ab/task/`).
- Arms: `v2` (`/bdk:subagent-execute-plan` of tag `v2.7.0` on a v2 plan file), `v3-long` (`evals/suites/execute-ab/variants/execute-long/`), `v3-thin` (`evals/suites/execute-ab/variants/execute-thin/`, at most 200 lines).
- Cells: `v2`, `v3-long`, `v3-long-prime` (a second, identical `v3-long` cell: the A/A pair), `v3-thin`; 5 runs per cell, cells interleaved per run; orchestrator `claude-opus-5-5`.
- Metrics per run, computed from the state the session leaves, not from its own summary (`evals/suites/execute-ab/metrics.ts`):
  - **acceptance** (primary): the fixture's whole test suite, the hidden acceptance tests, `tsc -b` and lint on the changed files; the fraction that passes.
  - **completeness** (primary): the expected steps present, as a fraction. v3: per task a ticket, an implementer package, an implementer report, passing `simplify`, `tests-scoped` and `lint` evidence of a ticket closed `ok`, a commit with the task trailer; per part `part done`. v2: per group a commit with the run's trailers, a test-runner and a static-analyse spawn after the group's implementer; per task an implementer spawn; a run manifest with every group done.
  - secondary: cost, turns, wall time; v3 only: `bdk` calls, calls that exit 3, calls that exit 2, mean envelope length in bytes; the rubric (the final message states the recorded end state, judged by `claude-sonnet-5`).

## Criterion

Pre-registered before the first measured run (design D-7 of the OpenSpec change `v3-t40-promptfoo-harness`).

**Difference rule** (T03 D-7): a gap between two cells counts as measurable only when their medians are further apart than the larger of the two within-cell ranges. Otherwise the result is "no measurable difference". The A/A pair `v3-long` / `v3-long-prime` shows the noise floor of the setup.

**Decision**: thin is "no worse" when, on both primary metrics (acceptance and completeness), `v3-thin` vs `v3-long` is either "no measurable difference" or measurably in favour of `v3-thin`. Then T41 writes thin stage skills. Otherwise T41 falls back to approach B.

- A measurable regression of `v3-thin` on a secondary metric does not fail the criterion. It is listed for T41 with its cause, for example exit-3 calls that point at a thin instruction template.
- The `v2` comparisons decide nothing in T40. A measurable primary regression of `v3-long` vs `v2` is raised to the user as a v3 risk for T50.
- Discarded runs (provider error, failed isolation check, harness error, no reported cost) are not counted in any metric and are listed with their reason.
- The decision is read mechanically from the rows by `pnpm eval report execute-ab`; this report copies the numbers and the decision from its output.

## Results

To be filled in from `evals/results/execute-ab/` after the measured series.
