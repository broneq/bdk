# Tasks

## 1. Eval case first

- [x] 1.1 Write `plugins/bdk/evals/close-review-decisions/` (D4): scaffold on `fixtures/tally-reviewed.sh` plus a `review/result.md` with an auto triage line and a product decision; graders: PR body holds both lines, reply names the product decision, skill fired.
- [x] 1.2 Run the scaffold in a temporary directory and check `review/result.md` and the repository state.
- [x] 1.3 Run the case once with the plugin against the current close skill and record the result (expected red on the PR body graders).

## 2. Skills (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/close/SKILL.md` step 7: the decisions part reads `review/result.md` too, grouped by source (D1, D2); step 8 reply unchanged in form.
- [x] 2.2 `plugins/bdk/skills/run/SKILL.md` step 9: decisions from `close/pr.md` only (D3).
- [x] 2.3 Run `close-review-decisions` with the plugin until green, and `close-reviewed-change` once as regression cover; record the results in `plugins/bdk/evals/README.md`.

## 3. Docs

- [x] 3.1 `docs/concepts/run-state.md`: the `review/result.md` row, the paragraph after the review diagram, and the close sequence diagram (redrawn: `/bdk:close` reads `review/result.md` before writing `close/pr-body.md`).
- [x] 3.2 `docs/concepts/gates-and-budgets.md`: the PR body lists the recorded decisions, the review's included.
- [x] 3.3 `pnpm docs:reference`; `pnpm check` reports no stale Reference page.

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: `close-review-decisions` grades the review's decision in the PR body.
- [x] 4.2 Every check CI runs (`.github/workflows/`), `openspec validate v3-375-close-pr-body-review-decisions --strict` and `openspec validate --specs --strict`.
