## MODIFIED Requirements

### Requirement: One review round

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration` and run `bdk check run <dir> round-<N> --at review --changed <base> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. After every reviewer has returned and the check run has ended, it SHALL start, in one message, one `bdk:e2e-tester` with the round's log, so its evidence lands in `<round dir>/e2e/`, and one `bdk:integration-reviewer` when the round has an `integration` group, each with the round directory; the E2E tester SHALL NOT run at the same time as the check run, so a project's full suite and the started product never compete for the same host. Then it SHALL start one `bdk:judge` with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks and E2E verdicts, the E2E one read from `<round dir>/e2e/verdict.md`, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents and `bdk check run ... --at review` start in one message, then `bdk:e2e-tester` and `bdk:integration-reviewer` in one message, then `bdk:judge`, and `round-1/review.md` and `round-1/round.md` exist

#### Scenario: E2E evidence per round

- **WHEN** round 2 of `monthly-report` runs after round 1 left `round-1/e2e/verdict.md`
- **THEN** the E2E tester writes `round-2/e2e/verdict.md` and its scenario files, `round-1/e2e/` is unchanged, and `round-2/round.md` gives the first line of `round-2/e2e/verdict.md`

#### Scenario: Only review items run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`when: [part]`), `unit` (`when: [wave, review]`) and `playwright` (`when: [review]`), and round 1 runs
- **THEN** `checks/round-1.json` holds `test unit` and `test playwright` with `at` `review`, and `vitest-related` did not run

### Requirement: A later round covers only the fix scope

A round after the first SHALL review only the commits since the last finished round: its `groups.json` anchor SHALL be of `kind` `round`, naming the previous round, and its groups SHALL hold only the files those commits changed, grouped by the previous round's fix parts. The checks of the `review` point and the E2E check SHALL run in every round, the checks with `--changed` against the base branch.

#### Scenario: Second round after a fix pass

- **WHEN** round 1 of `monthly-report` decided its parse finding `fix`, the fix pass committed a change to `src/parse.js` and its test, and round 2 runs
- **THEN** `round-2/groups.json` has `anchor.kind` `round` and `anchor.round` 1, its `files` hold `src/parse.js` and no file the fix commits did not change, such as `src/report.js` or a file under `openspec/`
