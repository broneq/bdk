## MODIFIED Requirements

### Requirement: Stage result

`/bdk:auto-review` SHALL write `<run dir>/review/result.md`, replacing an earlier one: the first line `Status: done` (the last round has no `fix` decision) or `Status: blocked`; then `## Rounds` (per round: the counts, the `fix` decisions, the fix parts and their pass), `## Deferred` (each finding decided `defer`, with its place, summary and level), `## Blockers` (what stopped the stage, with the command that continues it) and `## Decisions taken without the user`. An empty section SHALL hold `- None.` It SHALL reply with the status line, the path, and on `Status: done` the next stage `/bdk:close <change>`.

The status, the blockers and every round line SHALL come from the round files only (`findings.jsonl` through `bdk findings list`, `round.md`, `fixes/index.md`, `fixes/result.md`) and from the stage's own stops. `/bdk:auto-review` SHALL NOT read a project source file outside the skills it invokes (`triage`, `plan-fixes`). Neither a worker's reply nor what the main session read in the code SHALL change the status, add a blocker, or be named as a defect in the result or the reply: a defect counts only as a finding in a round's log.

#### Scenario: Done after a clean round

- **WHEN** round 2 holds no `fix` decision
- **THEN** `review/result.md` starts with `Status: done`, lists the deferred `nice-to-have` finding of round 1 under `## Deferred`, and the reply names `/bdk:close monthly-report`

#### Scenario: A suspicion outside the log does not block

- **WHEN** round 2 of `monthly-report` holds no `fix` decision and the round lead's reply mentions a defect in `src/report.js` that no finding of any round names
- **THEN** `review/result.md` starts with `Status: done` and lists no blocker, and the reply names no defect in `src/report.js`

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round`, `plan-fixes-present-behaviour` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage), `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits) and `auto-review-present-behaviour` (from round 1 of `add-total` on the fixture `tally-total-untested.sh`, triaged with the `fix` decision for the missing `Empty ledger` test, a budget of two rounds). `auto-review-first-round` SHALL grade that no `Agent` call starting a worker of the round (`bdk:reviewer`, `bdk:verifier`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`) lacks `run_in_background: false`, and, with the graders `verifier-in-round` and `conformance-written`, that the lead starts `bdk:verifier` for `spec-conformance` with `--round` and that `round-1/spec-conformance.md` exists. It SHALL also grade that the lead starts `bdk:integration-reviewer` in the same message as `bdk:e2e-tester`, so the integration reviewer never starts after the E2E tester has returned.


The suite SHALL also hold the orchestrator case `auto-review-test-only-fix` (from a judged round 1 whose E2E check passed and whose only finding to fix is a test gap, a budget of two rounds). Besides the carried E2E verdict, it SHALL grade that `review/result.md` agrees with its own round lines: `Status: done` when the line of round 2 names no `fix` decision, `Status: blocked` when it names one.

#### Scenario: Acceptance signal

- **WHEN** `auto-review-fix-round` runs with the plugin
- **THEN** its graders pass: `round-1/fixes/result.md` reads `Status: done`, `round-2/groups.json` is anchored on round 1 and holds only files of the fix commits, and `round-2/review.md` exists

#### Scenario: Round workers start in the foreground

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its foreground grader passes: every `Agent` call of the lead that starts a reviewer, the verifier, the integration reviewer, the E2E tester or the judge carries `"run_in_background": false`

#### Scenario: Integration reviewer starts with the E2E tester

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its `integration-with-e2e` grader passes: the lead's `bdk:integration-reviewer` call is in the same message as its `bdk:e2e-tester` call

#### Scenario: A fix part that only adds a test is built and committed

- **WHEN** `auto-review-present-behaviour` runs with the plugin
- **THEN** its graders pass: fix part `02` lists `Empty ledger` with ` (behaviour present)`, `round-1/fixes/state.json` has part `02` `done` and `round-1/fixes/result.md` reads `Status: done` (the lead committed the part), and `execute/part-02.md` starts with `Status: done` and its line for the scenario ends `; green at first run (behaviour present); green seen`

#### Scenario: Spec check in the first round

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its graders `verifier-in-round` and `conformance-written` pass

#### Scenario: Stage result agrees with the round files

- **WHEN** `auto-review-test-only-fix` runs with the plugin
- **THEN** its `result-agrees` grader passes: `review/result.md` reads `Status: done` with no `fix` decision on the line of round 2, or `Status: blocked` with one, and its `reply` grader passes
