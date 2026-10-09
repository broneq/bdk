## MODIFIED Requirements

### Requirement: One review round

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration` and run `bdk check run <dir> round-<N> --at review --changed <base> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. As soon as every reviewer has returned and the check run has ended, it SHALL start, in one message, one `bdk:integration-reviewer` when the round has an `integration` group and one `bdk:e2e-tester` with the round's log, so its evidence lands in `<round dir>/e2e/`, each with the round directory. The integration reviewer reads the group findings, not the E2E verdict, so it SHALL NOT wait for the E2E tester: it SHALL NOT be started after the E2E tester has returned. The E2E tester SHALL NOT run at the same time as the check run, so a project's full suite and the started product never compete for the same host. Then it SHALL start one `bdk:judge` with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks and E2E verdicts, the E2E one read from `<round dir>/e2e/verdict.md`, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents and `bdk check run ... --at review` start in one message, then `bdk:integration-reviewer` and `bdk:e2e-tester` in one message, then `bdk:judge`, and `round-1/review.md` and `round-1/round.md` exist

#### Scenario: E2E evidence per round

- **WHEN** round 2 of `monthly-report` runs after round 1 left `round-1/e2e/verdict.md`
- **THEN** the E2E tester writes `round-2/e2e/verdict.md` and its path files, `round-1/e2e/` is unchanged, and `round-2/round.md` gives the first line of `round-2/e2e/verdict.md`

#### Scenario: Only review items run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`when: [part]`), `unit` (`when: [wave, review]`) and `playwright` (`when: [review]`), and round 1 runs
- **THEN** `checks/round-1.json` holds `test unit` and `test playwright` with `at` `review`, and `vitest-related` did not run

#### Scenario: Integration reviewer does not wait for E2E

- **WHEN** round 1 of `monthly-report` has an `integration` group and its group reviewers and check run have ended
- **THEN** the `bdk:integration-reviewer` call is in the same message as the `bdk:e2e-tester` call, and no `bdk:integration-reviewer` call follows the E2E tester's result

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage) and `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits). `auto-review-first-round` SHALL grade that no `Agent` call starting a worker of the round (`bdk:reviewer`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`) lacks `run_in_background: false`. It SHALL also grade that the lead starts `bdk:integration-reviewer` in the same message as `bdk:e2e-tester`, so the integration reviewer never starts after the E2E tester has returned.

#### Scenario: Acceptance signal

- **WHEN** `auto-review-fix-round` runs with the plugin
- **THEN** its graders pass: `round-1/fixes/result.md` reads `Status: done`, `round-2/groups.json` is anchored on round 1 and holds only files of the fix commits, and `round-2/review.md` exists

#### Scenario: Round workers start in the foreground

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its foreground grader passes: every `Agent` call of the lead that starts a reviewer, the integration reviewer, the E2E tester or the judge carries `"run_in_background": false`

#### Scenario: Integration reviewer starts with the E2E tester

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its `integration-with-e2e` grader passes: the lead's `bdk:integration-reviewer` call is in the same message as its `bdk:e2e-tester` call
