# Tasks

## 1. Fixtures and cases

- [x] 1.1 Add `plugins/bdk/evals/fixtures/monthly-report-pr-force-pushed.sh` (design D1) and `monthly-report-pr-verified.sh` (D2). Verify: each builds in an empty directory; in the first, `git merge-base --is-ancestor <review 1 head> origin/monthly-report` exits 1; in the second, `bdk git groups <head> --record <dir>` writes `"groups":[]`.
- [x] 1.2 Add the case `judge-previous-repeat` (block) on `monthly-report.sh` with its graders (D3). Verify: `pnpm --filter @bdk/bdk exec vitest run tests/evals.test.ts`.
- [x] 1.3 Add the cases `pr-review-verify-force-push` and `pr-review-verify-no-new-commit` (orchestrator) with their graders (D3). Verify: `tests/evals.test.ts` passes.

## 2. Measure and record

- [x] 2.1 Run the three cases 3 times each with `--ablation none` (eval README commands, clean `HOME`, the `git` entry of "Host limits"). Verify: each scores 1.00 in 3 of 3 runs; the results are recorded in `plugins/bdk/evals/README.md`.
- [x] 2.2 Document the cases and fixtures in the eval README.

## 3. Specs

- [x] 3.1 Merge the delta specs into `openspec/specs/bdk-pr-review/spec.md` and `openspec/specs/review-blocks/spec.md` (`/opsx:sync`). Verify: `openspec validate --specs --strict`.
