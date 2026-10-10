# Tasks

## 1. Eval case first

- [x] 1.1 Write `plugins/bdk/evals/close-deferred-findings/` (D4): scaffold on `fixtures/tally-reviewed.sh` plus a `review/result.md` with a deferred `should-fix` (issue `#12`) and a deferred `nice-to-have` without issue; graders: PR body holds both, reply names them, skill fired.
- [x] 1.2 Run the scaffold in a temporary directory and check `review/result.md` and the repository state.
- [x] 1.3 Run the case once with the plugin against the current close skill and record the result (expected red on the PR body graders).

## 2. Skills (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/close/SKILL.md` step 7: a `Deferred` part from `## Deferred` of `review/result.md` (D1, D2); step 8 reply names them (D3).
- [x] 2.2 Run `close-deferred-findings` with the plugin until green, and `close-review-decisions` once as regression cover; record the results in `plugins/bdk/evals/README.md`.

## 3. Docs

- [x] 3.1 `docs/concepts/run-state.md`: the `review/result.md` row and the paragraph after the review diagram.
- [x] 3.2 `docs/concepts/findings.md`: a deferred finding is listed in the pull request body; the flow diagram's `defer` node is redrawn to say so.
- [x] 3.3 `pnpm docs:reference`; `pnpm check` reports no stale Reference page.

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: `close-deferred-findings` grades the deferred findings in the PR body.
- [x] 4.2 Every check CI runs (`.github/workflows/`), `openspec validate v3-381-close-pr-body-deferred-findings --strict` and `openspec validate --specs --strict`.
