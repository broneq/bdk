## 1. Eval case first

- [x] 1.1 Write the eval case `plugins/bdk/evals/judge-scenario-no-test/` (D4): scaffold on `fixtures/tally-total-untested.sh` with round 1 rewritten into three unleveled findings and no `review.md`; graders: `Empty ledger` and `Help` findings `should-fix`, negative-amounts finding `nice-to-have`, `review.md` exists, no `Edit`, skill fired.
- [x] 1.2 Run the scaffold in a temporary directory: `tally total` without a ledger prints `Total: 0.00`, `npm test` passes, the log has three unleveled findings.
- [x] 1.3 Run the case once with the plugin against the current judge and record the result (expected red on the `should-fix` grader; it was 1.00 in 3 of 3 on both models, design D6).

## 2. Skill (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/judge/SKILL.md`: the `should-fix` and `nice-to-have` rows, and the rule of D2/D3 (what the Change owes, when the finding holds), and step 2 reads the plan parts (D5).
- [x] 2.2 Run `judge-scenario-no-test` 3 times with the plugin (a separate test project per run, as the eval harness makes) and `judge-levels`, `judge-instruction`, `judge-spec-conformance`, `judge-previous-repeat` once each as regression cover; record the results in `plugins/bdk/evals/README.md`.

## 3. Docs

- [x] 3.1 `docs/concepts/findings.md` (Levels table) and `docs/concepts/stages.md` (the review stage's level summary); no diagram draws the levels, none is redrawn.
- [x] 3.2 `pnpm docs:reference`; verify `pnpm check` reports no stale Reference page.

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: `judge-scenario-no-test` levels the scenario finding `should-fix` and the other `nice-to-have` in 3 of 3 runs.
- [x] 4.2 Every check CI runs (`.github/workflows/`), `openspec validate v3-371-judge-scenario-no-test --strict` and `openspec validate --specs --strict`.
