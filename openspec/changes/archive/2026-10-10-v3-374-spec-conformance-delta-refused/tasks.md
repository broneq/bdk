## 1. Eval cases (before the skill text)

- [x] 1.1 Add the shared fixture `plugins/bdk/evals/fixtures/tally-delta-refused.sh` (tally-change plus a commit: the bad-amount error in the code and the proposal, the requirement Bad amount without a scenario in the delta, round 1 with an empty log); verify `openspec validate add-total --strict` fails on its output with `ADDED "Bad amount" must include at least one scenario`
- [x] 1.2 Add the block case `plugins/bdk/evals/spec-conformance-delta-refused/` (case.yaml, prompt.md, scaffold.sh, graders: round report `Verdict: FAIL`, finding on the delta naming the missing scenario, no close report, no edit, skill fired, verifier started); verify with `pnpm check`
- [x] 1.3 Add the block case `plugins/bdk/evals/judge-delta-refused/` (seeded unleveled finding, graders: `blocker`, review written, no edit, skill fired); verify with `pnpm check`
- [x] 1.4 Run both cases on the skills of `staging/v3` (with the plugin, one run) and record the before score

## 2. Skills (with /skill-creator)

- [x] 2.1 `plugins/bdk/skills/spec-conformance/SKILL.md`: run `openspec validate <change> --strict` first in step 3, problem 7 "Delta OpenSpec refuses", the `Checked` line, the finding's place in step 5, `allowed-tools` `Bash(openspec validate *)`; verify with `pnpm check`
- [x] 2.2 `plugins/bdk/skills/judge/SKILL.md`: change it only if `judge-delta-refused` fails on `staging/v3` (task 1.4); design D5 records the outcome
- [x] 2.3 Run `spec-conformance-delta-refused`, `judge-delta-refused` and the regression cases `spec-conformance-round` and `judge-spec-conformance` with the plugin; record the scores in `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/stages.md`: the `/bdk:spec-conformance --round` row (Review) and the `/bdk:spec-conformance` row (Close) name the OpenSpec validation; no diagram draws the problem list, none redrawn
- [x] 3.2 `docs/concepts/findings.md`: the `spec-conformance --round` source row names a delta OpenSpec refuses
- [x] 3.3 `docs/concepts/openspec-changes.md`: the close paragraph says the check runs `openspec validate --strict`
- [x] 3.4 `plugins/bdk/evals/README.md`: the fixture and the two cases with their grants
- [x] 3.5 Run `pnpm docs:reference` and commit the regenerated Reference

## 4. Acceptance and gates

- [x] 4.1 Acceptance: `spec-conformance-delta-refused` with the plugin gives `Verdict: FAIL` and a `spec-conformance` finding on the delta; `judge-delta-refused` gives `blocker`
- [x] 4.2 Run every check CI runs (`.github/workflows/`), `openspec validate v3-374-spec-conformance-delta-refused --strict` and `openspec validate --specs --strict`
