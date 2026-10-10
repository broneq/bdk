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

`review-round <change> --run-dir <dir> --round <N>` SHALL use the round directory `<dir>/review/round-<N>/`. When it holds no `groups.json`, the lead SHALL record the round with `bdk git groups <base> --rounds <dir>/review --plan <parts> --record <round dir>`, where `<parts>` is `<dir>/review/round-<N-1>/fixes/parts` when `N` is above 1 and that directory holds parts, else `openspec/changes/<change>/plan/parts`, and `<base>` the branch `origin/HEAD` names, else `main`; a `groups.json` already there SHALL be reused. In one message the lead SHALL start one `bdk:reviewer` per group other than `integration`, one `bdk:verifier` running `spec-conformance <change> --base <diff base> --round <round dir>`, the diff base being `origin/<base>` when that ref exists, else `<base>`, as `/bdk:close` passes it (spec `bdk-spec-conformance`, with the model `models.verifier` when the configuration sets it), and run `bdk check run <dir> round-<N> --at review --changed <base> --round <N>`; more than `execution.max-parallel` agents SHALL run in batches. The verifier SHALL run in every round, also one with no group, so a fix of the spec deltas or the code is checked against the specs again. As soon as every reviewer and the verifier have returned and the check run has ended, it SHALL start, in one message, one `bdk:integration-reviewer` when the round has an `integration` group and one `bdk:e2e-tester` with the round's log, so its evidence lands in `<round dir>/e2e/`, unless the round carries the E2E verdict over (Requirement: A later round covers only the fix scope), each with the round directory. The integration reviewer reads the group findings, not the E2E verdict, so it SHALL NOT wait for the E2E tester: it SHALL NOT be started after the E2E tester has returned. The E2E tester SHALL NOT run at the same time as the check run, so a project's full suite and the started product never compete for the same host. Then it SHALL start one `bdk:judge` with the round directory. A worker that returns no result SHALL be started once more; a second miss SHALL be listed in `round.md` under `## Gaps`. The lead SHALL write `<round dir>/round.md` (scope, groups and their counts, checks, spec conformance and E2E verdicts, the spec conformance one read from `<round dir>/spec-conformance.md` and the E2E one from `<round dir>/e2e/verdict.md` or, for a carried verdict, the reason and the verdict file carried over, the report, gaps) and reply with the report's counts line and path.

#### Scenario: First round in parallel

- **WHEN** round 1 of `monthly-report` runs with groups `p01`, `p02`, `unplanned` and `integration`
- **THEN** three `bdk:reviewer` agents, one `bdk:verifier` for `spec-conformance --round` and `bdk check run ... --at review` start in one message, then `bdk:integration-reviewer` and `bdk:e2e-tester` in one message, then `bdk:judge`, and `round-1/review.md`, `round-1/spec-conformance.md` and `round-1/round.md` exist

#### Scenario: E2E evidence per round

- **WHEN** round 2 of `monthly-report` runs after round 1 left `round-1/e2e/verdict.md`, and its fix commits changed `src/parse.js`
- **THEN** the E2E tester writes `round-2/e2e/verdict.md` and its path files, `round-1/e2e/` is unchanged, and `round-2/round.md` gives the first line of `round-2/e2e/verdict.md`

#### Scenario: Only review items run

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`when: [part]`), `unit` (`when: [wave, review]`) and `playwright` (`when: [review]`), and round 1 runs
- **THEN** `checks/round-1.json` holds `test unit` and `test playwright` with `at` `review`, and `vitest-related` did not run

#### Scenario: Integration reviewer does not wait for E2E

- **WHEN** round 1 of `monthly-report` has an `integration` group and its group reviewers, verifier and check run have ended
- **THEN** the `bdk:integration-reviewer` call is in the same message as the `bdk:e2e-tester` call, and no `bdk:integration-reviewer` call follows the E2E tester's result

#### Scenario: Spec conformance in a fix round

- **WHEN** round 2 of `add-total` runs after a fix pass that changed only the spec delta
- **THEN** the lead starts `bdk:verifier` for `spec-conformance add-total --round <run dir>/review/round-2`, and `round-2/round.md` gives the first line of `round-2/spec-conformance.md`

### Requirement: A later round covers only the fix scope

A round after the first SHALL review only the commits since the last finished round: its `groups.json` anchor SHALL be of `kind` `round`, naming the previous round, and its groups SHALL hold only the files those commits changed, grouped by the previous round's fix parts. The checks of the `review` point SHALL run in every round, with `--changed` against the base branch.

The E2E check SHALL run in every round except one that carries the last E2E verdict over. A round `N` above 1 SHALL carry it over if and only if its `groups.json` has `testsOnly` `true` (every changed, binary and deleted path of its scope is a test file, or the scope is empty) and the last E2E verdict, the first line of `round-<K>/e2e/verdict.md` for the highest `K` below `N` that has one, reads `Verdict: PASS` or `Verdict: SKIPPED`: the product is then the one that verdict checked. A round that carries the verdict over SHALL start no `bdk:e2e-tester` and write no `<round dir>/e2e/`, so the readers of the latest E2E verdict keep reading round `K`'s; its `round.md` SHALL say under `## E2E` that the check was not re-run, that the fix scope holds only test files (with their count), and the carried file with its first line. A round whose scope holds any other path, whose anchor fell back to the merge base with such a path in its scope, or whose last E2E verdict is `FAIL` or `BLOCKED` or missing SHALL run the E2E check.

#### Scenario: Second round after a fix pass

- **WHEN** round 1 of `monthly-report` decided its parse finding `fix`, the fix pass committed a change to `src/parse.js` and its test, and round 2 runs
- **THEN** `round-2/groups.json` has `anchor.kind` `round` and `anchor.round` 1, its `files` hold `src/parse.js` and no file the fix commits did not change, such as `src/report.js` or a file under `openspec/`, `testsOnly` is `false`, and the E2E tester runs

#### Scenario: Test-only fixes carry the verdict over

- **WHEN** `round-1/e2e/verdict.md` reads `Verdict: PASS`, the fix pass of round 1 committed changes to `test/parse.test.js` only, and round 2 runs
- **THEN** no `bdk:e2e-tester` starts, `round-2/e2e/` does not exist, and `round-2/round.md` says under `## E2E` that the check was not re-run because the fix scope holds only test files (1), carrying `round-1/e2e/verdict.md: Verdict: PASS`

#### Scenario: A failed verdict is never carried over

- **WHEN** `round-1/e2e/verdict.md` reads `Verdict: FAIL`, the fix pass of round 1 changed only test files, and round 2 runs
- **THEN** the E2E tester runs and writes `round-2/e2e/verdict.md`

#### Scenario: Carried over twice

- **WHEN** round 2 carried round 1's `Verdict: PASS` over, the fix pass of round 2 again changed only test files, and round 3 runs
- **THEN** round 3 starts no E2E tester and its `round.md` carries `round-1/e2e/verdict.md`

### Requirement: Fix parts

`plan-fixes <round dir>` SHALL read the findings of the round whose latest decision is `fix` and write fix parts `<round dir>/fixes/parts/NN.md` in the plan part format (`id`, `depends-on: []`, `isolation`, `files`; goal, acceptance scenarios, tasks with `File`, `Interface` and `Verified by`), one task per finding, each task naming its finding id. Ids SHALL continue after the highest part id of the plan and of every earlier round's fix parts. Findings on the same file SHALL be in the same part; parts SHALL keep to `plan.part.max-tasks` and `plan.part.max-files`; one part SHALL be `shared`, several parts SHALL have disjoint files and be `worktree`. A finding that breaks a spec scenario SHALL list that scenario as an acceptance scenario. A finding that asks for a test of a spec scenario whose behaviour the code already has (traced in the code to the scenario's THEN) SHALL list that scenario as an acceptance scenario with the suffix ` (behaviour present)`, and its task's `Verified by:` SHALL say that the new test passes at its first run; a finding asking for such a test of behaviour the code does not have SHALL list the scenario without the suffix. A finding whose fix adds or corrects spec-delta text so that the delta describes behaviour the proposal or the design already settles, and neither contradicts, SHALL be planned as a task on that delta file. A task that adds a requirement SHALL name at least one `#### Scenario:` for it, with the WHEN and the THEN the code gives, since OpenSpec refuses a requirement without one; the part SHALL list no acceptance scenario for the text the task writes. Its `Verified by:` SHALL name `openspec validate <change> --strict` and the next round's spec conformance. The block SHALL check the parts with `bdk plan check <round dir>/fixes/parts` and fix what it reports. It SHALL write `<round dir>/fixes/index.md` naming each `fix` finding's part, and under `## Not planned` each finding it cannot plan as a fix (its fix needs a product decision: the behaviour it would document or restore contradicts another scenario, the proposal or the design, or neither settles it; or its cause cannot be found) with the reason. It SHALL change no project file.

#### Scenario: Two findings on one file

- **WHEN** round 1 of `monthly-report` (plan parts `01` and `02`) decided `fix` for the parse blocker and the `amt` rename, both in `src/parse.js`, and `defer` and `accept` for the others
- **THEN** `round-1/fixes/parts/03.md` exists with `id: "03"`, `isolation: shared`, `src/parse.js` in `files`, a task per fixed finding naming its id, no task for the deferred or accepted findings, and `fixes/index.md` names part `03` for both

#### Scenario: Missing test of present behaviour

- **WHEN** round 1 of `add-total` (plan part `01`) decided `fix` for the finding that scenario `Empty ledger` has no test, and `tally total` already prints `Total: 0.00` for an empty ledger
- **THEN** `round-1/fixes/parts/02.md` lists `tally` / `Requirement: Total` / `Scenario: Empty ledger (behaviour present)` under `## Acceptance scenarios`, its task names the finding id and a test file, and no task changes `bin/tally.js`

#### Scenario: Error message missing from the delta

- **WHEN** round 1 of `add-total` decided `fix` for a `spec-conformance` finding on `openspec/changes/add-total/specs/tally/spec.md` saying no delta lists the error `tally: not an amount: <text>` that the proposal asks for
- **THEN** a fix part lists `openspec/changes/add-total/specs/tally/spec.md` in `files` with a task naming the finding, and `fixes/index.md` holds `- None.` under `## Not planned`

#### Scenario: Requirement added by a spec-text fix

- **WHEN** round 1 of `add-total` decided `fix` for a `spec-conformance` finding that no requirement of the delta or of the main spec `tally` describes the error `tally: not an amount: <text>`
- **THEN** the task for that finding asks to add a requirement with at least one `#### Scenario:` whose WHEN runs `tally add` with a value that is not a number and whose THEN names `tally: not an amount: <text>`, and its `Verified by:` names `openspec validate add-total --strict`

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
