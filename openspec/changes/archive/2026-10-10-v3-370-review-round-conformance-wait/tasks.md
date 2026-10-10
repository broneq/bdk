# Tasks

## 1. Eval grader first

- [x] 1.1 Add the grader `plugins/bdk/evals/auto-review-first-round/graders/verifier-with-integration.md` (trace regex: the `bdk:verifier` and `bdk:integration-reviewer` Agent calls share one assistant message id, D3) and update the case description; verify `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` passes.
- [x] 1.2 Run `auto-review-first-round` once with the plugin on the current `review-round`; verify the new grader is red (the verifier is in the reviewers' message) and record the score.

## 2. Skill (with /skill-creator)

- [x] 2.1 `review-round`: step 3 starts the group reviewers and the check run; step 4 starts the verifier, the integration reviewer and the E2E tester in one message, the verifier first in batches (D1, D2); the overview line and the description follow; verify with `auto-review-first-round` (all graders, the new one green) and `bdk-skill-kit` skill check.
- [x] 2.2 Record the eval results in `plugins/bdk/evals/README.md` next to the `auto-review-*` cases.

## 3. Docs

- [x] 3.1 `docs/concepts/orchestrators.md`: redraw the `/bdk:review-round` diagram (the verifier leaves step 3 and joins step 4, with the integration reviewer and the E2E tester) and its prose; verify with `pnpm --filter @bdk/docs docs:diagram-fit` and a screenshot of the page.
- [x] 3.2 `docs/concepts/stages.md` (the Review intro: which blocks run together) and `docs/concepts/e2e.md` (the E2E check starts with the verifier and the integration reviewer, after the reviewers and the checks); check `docs/concepts/agents.md`, `findings.md`, `run-state.md` and `docs/guide/` for an order statement and update any.
- [x] 3.3 `pnpm docs:reference`; verify `pnpm check` reports no stale Reference page.

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: `auto-review-first-round` with the plugin passes `verifier-with-integration`; one run A on a copy of #258's built B1-sized workspace with this plugin, the step-4 start read from the transcript within a few seconds of the end of step 3 (D4), recorded in design.md "Measurement".
- [x] 4.2 Every check CI runs (`.github/workflows/`): `pnpm check` and the other jobs; `openspec validate v3-370-review-round-conformance-wait --strict` and `openspec validate --specs --strict`.
