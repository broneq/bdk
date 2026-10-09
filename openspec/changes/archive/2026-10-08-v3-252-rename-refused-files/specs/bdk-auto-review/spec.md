# Spec Delta

## MODIFIED Requirements

### Requirement: One review round

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration`, one `bdk:e2e-tester` with the round's log, and run `bdk check run <dir> round-<N> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. After them it SHALL start one `bdk:integration-reviewer` when the round has an `integration` group, then one `bdk:judge`, each with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks and E2E verdicts, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents, one `bdk:e2e-tester` and `bdk check run` start in one message, then `bdk:integration-reviewer`, then `bdk:judge`, and `round-1/review.md` and `round-1/round.md` exist

### Requirement: Rounds until nothing is left to fix

`/bdk:auto-review` SHALL derive its next step from the round files: no round, or a last round without `review.md`, runs that round; a last round with an undecided finding runs `triage` on it; a last round without a `fix` decision ends the stage `done`; a last round with a `fix` decision and no `fixes/index.md` runs `plan-fixes`; a finding under `## Not planned` stops the stage `blocked`; no `fixes/result.md` with `Status: done` runs the fix pass, a `bdk:lead` with `execute-waves <change> --run-dir <dir> --parts <round dir>/fixes/parts`, and a blocked fix pass stops the stage `blocked`; a done fix pass runs the next round. Undecided findings left after a manual triage SHALL stop the stage until the user decides. Run again, the skill SHALL continue from the first missing file.

#### Scenario: Resume after a fix pass

- **WHEN** `round-1/` holds `review.md`, a `fix` decision, `fixes/index.md` and `fixes/result.md` reading `Status: done`, and no `round-2/` exists
- **THEN** `/bdk:auto-review` starts the lead for round 2 and runs neither triage nor `plan-fixes` nor a fix pass for round 1

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage) and `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits).

#### Scenario: Acceptance signal

- **WHEN** `auto-review-fix-round` runs with the plugin
- **THEN** its graders pass: `round-1/fixes/result.md` reads `Status: done`, `round-2/groups.json` is anchored on round 1 and holds only files of the fix commits, and `round-2/review.md` exists
