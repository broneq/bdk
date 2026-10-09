# Tasks

## 1. Offline gh stand-in

- [x] 1.1 Failing tests in `plugins/bdk/tests/evals.test.ts`: `gh api graphql` reviewThreads query built from recorded reviews (review node, one thread per inline comment, ids `PRRT_<n>_<k>_<i>`), `resolveReviewThread` recorded in `resolved.json` and shown by the next query, unknown thread and unknown query refused
- [x] 1.2 Extend `plugins/bdk/evals/fixtures/bin/gh`; tests green

## 2. Eval fixtures and cases

- [x] 2.1 Shared fixture `monthly-report-pr-reviewed.sh`: `monthly-report-pr.sh` plus a recorded review 7-1 (summary marker, `blocker` threads on `src/parse.js` and `src/report.js`) and a new head commit on `refs/pull/7/head` fixing only the parse bug
- [x] 2.2 Shared fixture `monthly-report-two-prs.sh`: `monthly-report-pr.sh` plus a correct pull request 8
- [x] 2.3 Cases `pr-review-verify` and `pr-review-several` (orchestrator) with scaffolds and graders
- [x] 2.4 Free check green: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`

## 3. Lead skill (with /skill-creator)

- [x] 3.1 `pr-review-round`: head check with `git ls-remote`, fetch without `FETCH_HEAD` with one retry on a lock, the verify mode (seed the log, `previous.json` with finding ids, judge only), `Mode:` in `result.md`

## 4. Orchestrator (with /skill-creator)

- [x] 4.1 `pr-review`: several pull requests, one lead each in one message, one confirmation for all; `--verify` (graphql query, `previous.json`, verify review, resolve fixed threads after posting); verify template in `references/comment-templates.md`
- [x] 4.2 Try `/bdk:pr-review --verify` and two pull requests in scratch projects built from the new scaffolds with `claude -p --plugin-dir plugins/bdk`; fix what the runs show

## 5. Documentation

- [x] 5.1 `plugins/bdk/evals/README.md`: the new fixtures and cases
- [x] 5.2 `CLAUDE.md` "Current state"
- [x] 5.3 User docs (after #271 landed): `docs/guide/workflow.md` (Other entry points), `docs/concepts/stages.md`, `docs/concepts/orchestrators.md` (several pull requests, the verify sequence), `docs/concepts/run-state.md` (`previous.json`); Reference regenerated with `pnpm docs:reference`

## 6. Acceptance and gates

- [x] 6.1 Run `pr-review-verify` and `pr-review-several` with `claude plugin eval` (one arm), re-run `pr-review-post` once; record the results in design.md "Measurements"
- [x] 6.2 Every check CI runs (`pnpm check` and the other jobs of `.github/workflows/pr.yml`), `openspec validate v3-256-pr-review-verify-multi --strict`, `openspec validate --specs --strict`
