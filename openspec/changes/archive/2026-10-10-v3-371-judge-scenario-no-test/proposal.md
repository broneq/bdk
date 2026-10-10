# Proposal

## Why

Tracks #371.

In the #258 measurement (Change `v3-258-measure-auto-review-b1`, design "Measurement", run B) a seeded defect removed the only tests of scenario `ledger-accounts / Transfers / Same account` while the behaviour stayed right. A group reviewer logged it ("deleting the from === to check keeps every test green"), but `/bdk:judge` levelled it `nice-to-have` ("only a test is missing"), so auto triage deferred it and the scenario would have reached the pull request untested. The judge's level table has no line for a scenario of the Change that no test verifies, although the plan part named that test as the scenario's check and a regression of the scenario would pass every check. #346 already lets a fix part add a test for present behaviour, so the review loop can fix such a finding once it is levelled to be fixed.

## What Changes

- `judge`: a finding that a scenario the Change owes has no test, with the behaviour present, is `should-fix`. The Change owes a scenario's test when the scenario is in the Change's spec deltas, or a plan part names it under `Acceptance scenarios` or `Verified by`. A test gap that no such scenario asks for stays `nice-to-have`. The behaviour broken stays `blocker`, as before.
- New eval case `judge-scenario-no-test` on the existing fixture `tally-total-untested.sh` (round 1 rewritten unleveled, no finding naming its scenario): the scenarios `Empty ledger` and `Help` without a test level `should-fix`, a test gap of `tally total` no scenario asks for levels `nice-to-have`.
- `judge` step 2 reads the plan parts' `Acceptance scenarios` and `Verified by` lines when a finding says a test is missing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-blocks`: the `should-fix` level covers a scenario the Change owes without a test; the eval case `judge-scenario-no-test`.

## Impact

- `plugins/bdk/skills/judge/SKILL.md` (level table and the scenario-test rule).
- `plugins/bdk/evals/judge-scenario-no-test/`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/findings.md` (the Levels table) and `docs/concepts/stages.md` (the review stage's level summary); Reference regenerated with `pnpm docs:reference`. No diagram draws the level definitions, so none is redrawn.
- `docs/design/2026-10-07-v3-skills-decisions.md` holds the original table of D2; it is a design record, left as written.
- No CLI change, no triage change: auto triage already decides `should-fix` as `fix` (and `defer` in the last round).
- Out of scope: the #258 measurement itself; how reviewers find test gaps (`review-group`, `review-integration` already log them).
