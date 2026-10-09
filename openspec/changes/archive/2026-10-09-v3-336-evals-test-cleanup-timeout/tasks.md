# Tasks

## 1. Reproduce and measure

- [x] 1.1 Reproduce the hook timeout: four full `pnpm test` runs with the `afterAll` delete timed; verified by two runs failing with `Hook timed out in 10000ms` and the logged entry counts and delete times recorded in design.md (Context).

## 2. Per-test cleanup

- [x] 2.1 In `plugins/bdk/tests/evals.test.ts` and `tests/eval-suites.test.ts`, make `fresh()` register an `onTestFinished` delete for the directory it creates; verified by `npx vitest run plugins/bdk/tests/evals.test.ts tests/eval-suites.test.ts` passing.
- [x] 2.2 Measure the per-test deletes under three full `pnpm test` runs (temporary logging, removed afterwards); verified by the largest delete staying far below the 10 s hook timeout (607 entries, 776 ms) and all three runs passing.

## 3. Acceptance

- [x] 3.1 Run `pnpm check` five times in a row; verified by five passes with no hook timeout (5/5 passed).
- [x] 3.2 Run the gates: `pnpm docs:reference` (no diff), every check of `.github/workflows/`, `openspec validate --specs --strict`.
