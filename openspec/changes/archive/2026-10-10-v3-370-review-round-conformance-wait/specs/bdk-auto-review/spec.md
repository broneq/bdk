# Spec Delta

## MODIFIED Requirements

### Requirement: One review round

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration` and run `bdk check run <dir> round-<N> --at review --changed <base> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. As soon as every reviewer has returned and the check run has ended, it SHALL start, in one message, one `bdk:verifier` running `spec-conformance <change> --base <diff base> --round <round dir>`, the diff base being `origin/<base>` when that ref exists, else `<base>`, as `/bdk:close` passes it (spec `bdk-spec-conformance`, with the model `models.verifier` when the configuration sets it), one `bdk:integration-reviewer` when the round has an `integration` group and one `bdk:e2e-tester` with the round's log, so its evidence lands in `<round dir>/e2e/`, unless the round carries the E2E verdict over (Requirement: A later round covers only the fix scope), each with the round directory; when they number more than `execution.max-parallel`, the verifier SHALL be in the first batch. The verifier SHALL run in every round, also one with no group, so a fix of the spec deltas or the code is checked against the specs again. It reads neither the group findings nor the E2E results, so it SHALL NOT start after the integration reviewer or the E2E tester has returned; the integration reviewer reads the group findings, not the verifier's findings nor the E2E verdict, so it SHALL NOT be started after the verifier or the E2E tester has returned. A problem the verifier and the integration reviewer both log is a repeat the judge levels `not-a-problem`. The E2E tester SHALL NOT run at the same time as the check run, so a project's full suite and the started product never compete for the same host. Then it SHALL start one `bdk:judge` with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks, spec conformance and E2E verdicts, the spec conformance one read from `<round dir>/spec-conformance.md` and the E2E one from `<round dir>/e2e/verdict.md` or, for a carried verdict, the reason and the verdict file carried over, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents and `bdk check run ... --at review` start in one message, then one `bdk:verifier` for `spec-conformance --round`, `bdk:integration-reviewer` and `bdk:e2e-tester` in one message, then `bdk:judge`, and `round-1/review.md`, `round-1/spec-conformance.md` and `round-1/round.md` exist

#### Scenario: E2E evidence per round

- **WHEN** round 2 of `monthly-report` runs after round 1 left `round-1/e2e/verdict.md`, and its fix commits changed `src/parse.js`
- **THEN** the E2E tester writes `round-2/e2e/verdict.md` and its path files, `round-1/e2e/` is unchanged, and `round-2/round.md` gives the first line of `round-2/e2e/verdict.md`

#### Scenario: Only review items run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`when: [part]`), `unit` (`when: [wave, review]`) and `playwright` (`when: [review]`), and round 1 runs
- **THEN** `checks/round-1.json` holds `test unit` and `test playwright` with `at` `review`, and `vitest-related` did not run

#### Scenario: Integration reviewer does not wait for E2E

- **WHEN** round 1 of `monthly-report` has an `integration` group and its group reviewers and check run have ended
- **THEN** the `bdk:integration-reviewer` call is in the same message as the `bdk:e2e-tester` call, and no `bdk:integration-reviewer` call follows the E2E tester's result

#### Scenario: Step 4 does not wait for the verifier

- **WHEN** round 1 of `monthly-report` has an `integration` group, its group reviewers return after 20 s, the check run ends, and the verifier takes 110 s
- **THEN** the `bdk:verifier` call is in the same message as the `bdk:integration-reviewer` and `bdk:e2e-tester` calls, after the reviewers' results, so neither of them starts after the verifier's result

#### Scenario: Spec conformance in a fix round

- **WHEN** round 2 of `add-total` runs after a fix pass that changed only the spec delta
- **THEN** the lead starts `bdk:verifier` for `spec-conformance add-total --round <run dir>/review/round-2`, and `round-2/round.md` gives the first line of `round-2/spec-conformance.md`

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round`, `plan-fixes-present-behaviour` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage), `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits) and `auto-review-present-behaviour` (from round 1 of `add-total` on the fixture `tally-total-untested.sh`, triaged with the `fix` decision for the missing `Empty ledger` test, a budget of two rounds). `auto-review-first-round` SHALL grade that no `Agent` call starting a worker of the round (`bdk:reviewer`, `bdk:verifier`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`) lacks `run_in_background: false`, and, with the graders `verifier-in-round` and `conformance-written`, that the lead starts `bdk:verifier` for `spec-conformance` with `--round` and that `round-1/spec-conformance.md` exists. It SHALL also grade that the lead starts `bdk:integration-reviewer` in the same message as `bdk:e2e-tester`, so the integration reviewer never starts after the E2E tester has returned, and, with the grader `verifier-with-integration`, that the lead starts `bdk:verifier` in the same message as `bdk:integration-reviewer`, so neither the integration reviewer nor the E2E tester waits for the verifier.


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

#### Scenario: Verifier starts with the integration reviewer

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its `verifier-with-integration` grader passes: the lead's `bdk:verifier` call is in the same message as its `bdk:integration-reviewer` call

#### Scenario: Stage result agrees with the round files

- **WHEN** `auto-review-test-only-fix` runs with the plugin
- **THEN** its `result-agrees` grader passes: `review/result.md` reads `Status: done` with no `fix` decision on the line of round 2, or `Status: blocked` with one, and its `reply` grader passes
