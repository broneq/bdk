## Why

Tracks #264.

A later review round re-runs the whole E2E check even when its fix commits cannot change what a user observes. The #208 measurement (archived Change `v3-208-measure-speed-b1`, design "Measurement") on the B1-sized Change: in both runs the round-1 fixes touched only test files, yet round 2 drove every scenario again (85 s and 102 s), its longest worker, and found nothing. The v2/draft1 findings name the same cost: "Review reruns everything every round" (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`). This serves speed, problem 1 of v3, without giving up correctness: the product a user sees is still checked whenever a fix can change it.

## What Changes

- `bdk git scope` and `bdk git groups` name the test files of the range: a new `tests` list (the changed, binary and deleted paths that follow a test-file naming convention, such as `test/`, `__tests__/`, `*.test.*`, `*_test.*`) and `testsOnly` (every changed path is a test file). `groups.json` records both. The text output gives the test files.
- A review round after the first runs no E2E check when its fix scope holds only test files and the last E2E verdict of an earlier round is `PASS` or `SKIPPED`: the product is the one that verdict checked. The round writes no `e2e/` directory, so `/bdk:close` and `/bdk:spec-conformance` keep reading the last real verdict, and its `round.md` says the E2E check was not re-run, why, and which verdict stands.
- A fix that touches any other file (product code, configuration, a deleted or binary file), a round whose anchor fell back to the merge base, and a round after a `FAIL` or `BLOCKED` verdict still get the full E2E check.
- Eval cases of `/bdk:auto-review`: a fix round whose fix touches only a test file skips the E2E check; the existing fix round, whose fix touches product code, still runs it.

Out of scope: running the E2E check for only the processes a product fix touched (decided against in design.md, D4); the integration reviewer waiting for the E2E tester (#263); spec-conformance gaps found late (#265).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/git`: the scope result names the test files of the range (`tests`, `testsOnly`).
- `bdk-auto-review`: a later round skips the E2E check when its fix scope holds only test files and the last E2E verdict passed or was skipped, and records why in `round.md`.

## Impact

- `plugins/bdk/src/git/` (domain, schema, use case, render, tests) and `plugins/bdk/tests/git.test.ts` if the real-git test covers the field.
- `plugins/bdk/skills/review-round/SKILL.md`; `plugins/bdk/skills/auto-review/SKILL.md` only if its description names the E2E check in every round.
- `plugins/bdk/evals/`: a new case `auto-review-test-only-fix` and a grader in `auto-review-fix-round` that its round 2 still ran the E2E check.
- User docs: `docs/concepts/orchestrators.md` (the review round diagram and its text), `docs/concepts/e2e.md` ("Reading the result"), `docs/concepts/run-state.md` (the `review/round-N/e2e/` row); the Reference regenerated with `pnpm docs:reference`.
- Specs `bdk-cli/git`, `bdk-auto-review`.
