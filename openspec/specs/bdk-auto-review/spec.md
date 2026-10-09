# bdk-auto-review Specification

## Purpose

Defines the review stage of the `bdk` plugin: the orchestrator `/bdk:auto-review`, which repeats review rounds, triage and fixes until no finding is left to fix; the lead skill `review-round`, which runs one round; and the block `plan-fixes`, which turns the findings to fix into fix parts.

## Requirements

### Requirement: Skills

The `bdk` plugin SHALL ship the skills `auto-review` (`skills/auto-review/`, the user command `/bdk:auto-review`), `review-round` (`skills/review-round/`, not user-invocable) and `plan-fixes` (`skills/plan-fixes/`). `review-round` SHALL run only on `bdk:lead`; started anywhere else it SHALL do nothing and name `/bdk:auto-review`. `/bdk:auto-review` SHALL review, fix, triage and plan nothing itself: it SHALL start `review-round` and the fix pass in `bdk:lead` agents and invoke `triage` and `plan-fixes`.

#### Scenario: Round in a lead

- **WHEN** `/bdk:auto-review monthly-report` runs on a Change with every plan part done and no review round
- **THEN** the main conversation starts one `bdk:lead` agent whose prompt names the skill `bdk:review-round` and the arguments `monthly-report --run-dir <absolute .bdk/runs/monthly-report> --round 1`, and starts no reviewer itself

### Requirement: Start of the stage

`/bdk:auto-review [<change>]` SHALL get the configuration from its own `bdk config show` block and, in a project that is not configured or whose configuration is invalid, stop with the line that command prints, starting nothing. Without a Change name it SHALL take the only Change under `openspec/changes/` other than `archive/`; with none or several it SHALL name what it found and stop. When `.bdk/runs/run.json` queues the Change, it SHALL read the Change's stage from `bdk run status --json`: an earlier stage SHALL stop with that stage's command; `close` or `done` SHALL reply that the review is done. It SHALL start each lead in the background when `execution.lead` is `background` and in the foreground when it is `foreground`, with `model` set to `models.lead` when the configuration sets it, and SHALL wait for its result.

#### Scenario: Plan not built

- **WHEN** `run.json` queues `monthly-report` and `bdk run status --json` reports its stage `execute`
- **THEN** no agent starts and the reply names `execute` and `/bdk:execute monthly-report`

### Requirement: One review round

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration` and run `bdk check run <dir> round-<N> --at review --changed <base> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. After every reviewer has returned and the check run has ended, it SHALL start, in one message, one `bdk:e2e-tester` with the round's log, so its evidence lands in `<round dir>/e2e/`, and one `bdk:integration-reviewer` when the round has an `integration` group, each with the round directory; the E2E tester SHALL NOT run at the same time as the check run, so a project's full suite and the started product never compete for the same host. Then it SHALL start one `bdk:judge` with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks and E2E verdicts, the E2E one read from `<round dir>/e2e/verdict.md`, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents and `bdk check run ... --at review` start in one message, then `bdk:e2e-tester` and `bdk:integration-reviewer` in one message, then `bdk:judge`, and `round-1/review.md` and `round-1/round.md` exist

#### Scenario: E2E evidence per round

- **WHEN** round 2 of `monthly-report` runs after round 1 left `round-1/e2e/verdict.md`
- **THEN** the E2E tester writes `round-2/e2e/verdict.md` and its path files, `round-1/e2e/` is unchanged, and `round-2/round.md` gives the first line of `round-2/e2e/verdict.md`

#### Scenario: Only review items run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`when: [part]`), `unit` (`when: [wave, review]`) and `playwright` (`when: [review]`), and round 1 runs
- **THEN** `checks/round-1.json` holds `test unit` and `test playwright` with `at` `review`, and `vitest-related` did not run

### Requirement: A later round covers only the fix scope

A round after the first SHALL review only the commits since the last finished round: its `groups.json` anchor SHALL be of `kind` `round`, naming the previous round, and its groups SHALL hold only the files those commits changed, grouped by the previous round's fix parts. The checks of the `review` point and the E2E check SHALL run in every round, the checks with `--changed` against the base branch.

#### Scenario: Second round after a fix pass

- **WHEN** round 1 of `monthly-report` decided its parse finding `fix`, the fix pass committed a change to `src/parse.js` and its test, and round 2 runs
- **THEN** `round-2/groups.json` has `anchor.kind` `round` and `anchor.round` 1, its `files` hold `src/parse.js` and no file the fix commits did not change, such as `src/report.js` or a file under `openspec/`

### Requirement: Fix parts

`plan-fixes <round dir>` SHALL read the findings of the round whose latest decision is `fix` and write fix parts `<round dir>/fixes/parts/NN.md` in the plan part format (`id`, `depends-on: []`, `isolation`, `files`; goal, acceptance scenarios, tasks with `File`, `Interface` and `Verified by`), one task per finding, each task naming its finding id. Ids SHALL continue after the highest part id of the plan and of every earlier round's fix parts. Findings on the same file SHALL be in the same part; parts SHALL keep to `plan.part.max-tasks` and `plan.part.max-files`; one part SHALL be `shared`, several parts SHALL have disjoint files and be `worktree`. A finding that breaks a spec scenario SHALL list that scenario as an acceptance scenario. The block SHALL check the parts with `bdk plan check <round dir>/fixes/parts` and fix what it reports. It SHALL write `<round dir>/fixes/index.md` naming each `fix` finding's part, and under `## Not planned` each finding it cannot plan as a fix (its fix needs a spec or design change, or its cause cannot be found) with the reason. It SHALL change no project file.

#### Scenario: Two findings on one file

- **WHEN** round 1 of `monthly-report` (plan parts `01` and `02`) decided `fix` for the parse blocker and the `amt` rename, both in `src/parse.js`, and `defer` and `accept` for the others
- **THEN** `round-1/fixes/parts/03.md` exists with `id: "03"`, `isolation: shared`, `src/parse.js` in `files`, a task per fixed finding naming its id, no task for the deferred or accepted findings, and `fixes/index.md` names part `03` for both

### Requirement: Rounds until nothing is left to fix

`/bdk:auto-review` SHALL derive its next step from the round files: no round, or a last round without `review.md`, runs that round; a last round with an undecided finding runs `triage` on it; a last round without a `fix` decision ends the stage `done`; a last round with a `fix` decision and no `fixes/index.md` runs `plan-fixes`; a finding under `## Not planned` stops the stage `blocked`; no `fixes/result.md` with `Status: done` runs the fix pass, a `bdk:lead` with `execute-waves <change> --run-dir <dir> --parts <round dir>/fixes/parts`, and a blocked fix pass stops the stage `blocked`; a done fix pass runs the next round. Undecided findings left after a manual triage SHALL stop the stage until the user decides. Run again, the skill SHALL continue from the first missing file.

#### Scenario: Resume after a fix pass

- **WHEN** `round-1/` holds `review.md`, a `fix` decision, `fixes/index.md` and `fixes/result.md` reading `Status: done`, and no `round-2/` exists
- **THEN** `/bdk:auto-review` starts the lead for round 2 and runs neither triage nor `plan-fixes` nor a fix pass for round 1

### Requirement: Round budget

The number of rounds SHALL NOT exceed `policy.budgets.review-rounds`. When round `N` is at or above the budget, `/bdk:auto-review` SHALL run `triage` with `--last-round`. A `fix` decision left in the last allowed round SHALL get no fix pass: the stage SHALL stop `blocked`, naming each such finding and the ways on (raise the budget and run `/bdk:auto-review` again, or change the decision with `/bdk:triage`).

#### Scenario: Budget spent with a blocker

- **WHEN** `policy.budgets.review-rounds` is 2 and round 2 holds a `blocker` decided `fix`
- **THEN** no fix pass starts, `review/result.md` starts with `Status: blocked`, and the reply names the finding and `policy.budgets.review-rounds`

### Requirement: Stage result

`/bdk:auto-review` SHALL write `<run dir>/review/result.md`, replacing an earlier one: the first line `Status: done` (the last round has no `fix` decision) or `Status: blocked`; then `## Rounds` (per round: the counts, the `fix` decisions, the fix parts and their pass), `## Deferred` (each finding decided `defer`, with its place, summary and level), `## Blockers` (what stopped the stage, with the command that continues it) and `## Decisions taken without the user`. An empty section SHALL hold `- None.` It SHALL reply with the status line, the path, and on `Status: done` the next stage `/bdk:close <change>`.

#### Scenario: Done after a clean round

- **WHEN** round 2 holds no `fix` decision
- **THEN** `review/result.md` starts with `Status: done`, lists the deferred `nice-to-have` finding of round 1 under `## Deferred`, and the reply names `/bdk:close monthly-report`

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage) and `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits). `auto-review-first-round` SHALL grade that no `Agent` call starting a worker of the round (`bdk:reviewer`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`) lacks `run_in_background: false`.

#### Scenario: Acceptance signal

- **WHEN** `auto-review-fix-round` runs with the plugin
- **THEN** its graders pass: `round-1/fixes/result.md` reads `Status: done`, `round-2/groups.json` is anchored on round 1 and holds only files of the fix commits, and `round-2/review.md` exists

#### Scenario: Round workers start in the foreground

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its foreground grader passes: every `Agent` call of the lead that starts a reviewer, the integration reviewer, the E2E tester or the judge carries `"run_in_background": false`
