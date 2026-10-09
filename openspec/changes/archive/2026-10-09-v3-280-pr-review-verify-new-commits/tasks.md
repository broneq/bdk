## 1. Conflict markers on staging

- [x] 1.1 Write the failing root test `tests/conflict-markers.test.ts`: every tracked text file (`git ls-files`) has no line that is a git conflict marker; verify it fails on the current tree (`pnpm vitest run tests/conflict-markers.test.ts`)
- [x] 1.2 Resolve the markers #277's merge left in `plugins/bdk/skills/pr-review/SKILL.md`, `plugins/bdk/skills/pr-review-round/SKILL.md` and `openspec/specs/bdk-pr-review/spec.md` (keep the #256 side, which already says `review.md`); the test passes

## 2. Eval case first

- [x] 2.1 Write the fixture `plugins/bdk/evals/fixtures/monthly-report-pr-regressed.sh` (design D7) and run it in a scratch directory: `npm test` passes, `ledger report` on the scenario's file prints `2026-01 2.25`, and `gh api graphql` of the stand-in lists threads `PRRT_7_1_1` and `PRRT_7_1_2`
- [x] 2.2 Write the case `plugins/bdk/evals/pr-review-verify-regression/` (case.yaml, prompt.md, scaffold.sh, graders per design D7) and add to `pr-review-verify` a grader that `bdk:reviewer` ran; `pnpm --filter @bdk/bdk test` passes (case layout tests)

## 3. Skills (with /skill-creator)

- [x] 3.1 `judge`: the later of two repeating findings is `not-a-problem` naming the earlier id (design D3)
- [x] 3.2 `pr-review-round`: `--since <sha>`, seed before reviewers, the delta range base by `merge-base --is-ancestor` (D1), reviewers, integration and judge in verify mode, the judge alone with no new commit (D6), `Reviewed:` in `result.md` (D2)
- [x] 3.3 `pr-review`: pass `--since` to the lead; render new findings, the verdict and the reviewed commits in verify mode (D4); the verify template in `references/comment-templates.md` without the "checked only" note (D5)
- [x] 3.4 `bdk-skill-kit` skill-check passes on the three skills (`pnpm check`)

## 4. Eval runs

- [x] 4.1 Run `pr-review-verify-regression` and `pr-review-verify` with `claude plugin eval` (README "pr-review-*" command, `--ablation none`) from a separate workspace; both pass; record score, cost and time in design.md "Measurements"
- [x] 4.2 Try `/bdk:pr-review --verify 7` by hand in a separate test project built from `monthly-report-pr-regressed.sh`, started with `claude --plugin-dir`, without posting; record what it showed

## 5. Docs

- [x] 5.1 Update `docs/guide/workflow.md` ("Any pull request"), `docs/concepts/stages.md` and `docs/concepts/orchestrators.md` (the verify diagram and text) to say verify reviews the commits since the previous review; `plugins/bdk/evals/README.md` (the `pr-review-*` paragraph and the shared fixtures list); `CLAUDE.md` "Current state" names #280
- [x] 5.2 Run `pnpm docs:reference`; `pnpm check` passes on the docs name check

## 6. Acceptance and gates

- [x] 6.1 Acceptance signal end to end: the `pr-review-verify-regression` run resolves both old threads, posts an inline comment on the new `src/report.js` blocker and requests changes (task 4.1 result)
- [x] 6.2 Every check CI runs (`.github/workflows/`: `pnpm check` and the other jobs), `openspec validate v3-280-pr-review-verify-new-commits --strict` and `openspec validate --specs --strict` pass
