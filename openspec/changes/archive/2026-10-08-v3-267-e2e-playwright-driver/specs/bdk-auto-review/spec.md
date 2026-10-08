## MODIFIED Requirements

### Requirement: One review round

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration`, one `bdk:e2e-tester` with the round's log, so its evidence lands in `<round dir>/e2e/`, and run `bdk check run <dir> round-<N> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. After them it SHALL start one `bdk:integration-reviewer` when the round has an `integration` group, then one `bdk:judge`, each with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks and E2E verdicts, the E2E one read from `<round dir>/e2e/verdict.md`, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents, one `bdk:e2e-tester` and `bdk check run` start in one message, then `bdk:integration-reviewer`, then `bdk:judge`, and `round-1/report.md` and `round-1/round.md` exist

#### Scenario: E2E evidence per round

- **WHEN** round 2 of `monthly-report` runs after round 1 left `round-1/e2e/verdict.md`
- **THEN** the E2E tester writes `round-2/e2e/verdict.md` and its scenario files, `round-1/e2e/` is unchanged, and `round-2/round.md` gives the first line of `round-2/e2e/verdict.md`
