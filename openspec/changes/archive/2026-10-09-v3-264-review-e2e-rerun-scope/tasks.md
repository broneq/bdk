## 1. Test files in the scope (`bdk-cli/git`)

The problem: the #208 measurement (design "Context"): round 2 re-ran the whole E2E check for test-only fixes.

- [x] 1.1 Failing tests first: `src/git/tests/tests.test.ts` for the convention (scenarios "Conventions of several languages", "Look-alike names are not tests"), `src/git/tests/use-cases.test.ts` for `tests` and `testsOnly` in `scope` and `groups` ("Fix range of test files only", "Fix range with a product file", "Nothing to review"), and the real-git test `tests/git.test.ts` for the recorded `groups.json`
- [x] 1.2 `src/git/domain/tests.ts` (`isTestFile`), `schema/scope.ts` (`tests`, `testsOnly`), `use-cases/scope.ts`, `render/scope.ts` (the test files in the text output); tests green
- [x] 1.3 The recorded `groups.json` of the eval fixtures (`fixtures/monthly-report.sh`, any other) carries the new fields, so a fixture shows what the CLI writes

## 2. Eval cases (before the skill text)

- [x] 2.1 New case `auto-review-test-only-fix`: `monthly-report` with round 1 judged (one `should-fix` finding whose fix is a test of `src/parse.test.js`, one `nice-to-have`), `round-1/e2e/verdict.md` reading `Verdict: PASS`, a `cli` `tools.e2e` item, review gate auto, budget 2; graders: `round-2/groups.json` has `"testsOnly":true`, `round-2/e2e/verdict.md` does not exist, `round-2/round.md` says the E2E check was not re-run and names `round-1/e2e/verdict.md`, `round-2/review.md` exists
- [x] 2.2 `auto-review-fix-round`: grader that round 2 (fix in `src/parse.js`) wrote `round-2/e2e/verdict.md`
- [x] 2.3 `evals/README.md`: the new case in the review stage paragraph

## 3. `review-round` (with `/skill-creator`)

- [x] 3.1 Step 2 notes `testsOnly` and `tests`; step 4 decides the E2E check: carry over when `N` > 1, `testsOnly` is true and the last E2E verdict (highest `K` < `N` with `round-K/e2e/verdict.md`) is `PASS` or `SKIPPED`, else start the tester; drop "The E2E check runs in every round, also one with no group"
- [x] 3.2 Step 6: the `## E2E` line of a carried verdict; the description if it names the E2E check per round
- [x] 3.3 The skill tests of `pnpm check` pass on the skill (the `bdk` plugin has no `skill-check` config)

## 4. Docs

- [x] 4.1 `docs/concepts/orchestrators.md`: the review round sequence diagram (the E2E tester is skipped on a carried verdict: an `alt` around it) and the text under it
- [x] 4.2 `docs/concepts/e2e.md` "Reading the result": a later round of test-only fixes carries the last verdict over and writes no `e2e/`
- [x] 4.3 `docs/concepts/run-state.md`: the `review/round-N/e2e/` row (absent in a round that carried the verdict over) and `groups.json` fields if listed
- [x] 4.4 `pnpm docs:reference`

## 5. Run the evals

- [x] 5.1 `auto-review-test-only-fix` and `auto-review-fix-round` in a plain terminal pane, results recorded in design.md "Measurement"

## 6. Acceptance and gates

- [x] 6.1 Acceptance on the B1-sized Change: `/bdk:run` on `household-book-queued.sh` with the plugin built from this branch, as #208 did; record round 2's E2E decision and time in design.md "Measurement"
- [x] 6.2 Every check of `.github/workflows/` (`pnpm check` and the others), `openspec validate v3-264-review-e2e-rerun-scope --strict`, `openspec validate --specs --strict`
