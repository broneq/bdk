## MODIFIED Requirements

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

### Requirement: Fix parts

`plan-fixes <round dir>` SHALL read the findings of the round whose latest decision is `fix` and write fix parts `<round dir>/fixes/parts/NN.md` in the plan part format (`id`, `depends-on: []`, `isolation`, `files`; goal, acceptance scenarios, tasks with `File`, `Interface` and `Verified by`), one task per finding, each task naming its finding id. Ids SHALL continue after the highest part id of the plan and of every earlier round's fix parts. Findings on the same file SHALL be in the same part; parts SHALL keep to `plan.part.max-tasks` and `plan.part.max-files`; one part SHALL be `shared`, several parts SHALL have disjoint files and be `worktree`. A finding that breaks a spec scenario SHALL list that scenario as an acceptance scenario. A finding that asks for a test of a spec scenario whose behaviour the code already has (traced in the code to the scenario's THEN) SHALL list that scenario as an acceptance scenario with the suffix ` (behaviour present)`, and its task's `Verified by:` SHALL say that the new test passes at its first run; a finding asking for such a test of behaviour the code does not have SHALL list the scenario without the suffix. A finding whose fix adds or corrects spec-delta text so that the delta describes behaviour the proposal or the design already settles, and neither contradicts, SHALL be planned as a task on that delta file, verified by the next round's spec conformance. The block SHALL check the parts with `bdk plan check <round dir>/fixes/parts` and fix what it reports. It SHALL write `<round dir>/fixes/index.md` naming each `fix` finding's part, and under `## Not planned` each finding it cannot plan as a fix (its fix needs a product decision: the behaviour it would document or restore contradicts another scenario, the proposal or the design, or neither settles it; or its cause cannot be found) with the reason. It SHALL change no project file.

#### Scenario: Two findings on one file

- **WHEN** round 1 of `monthly-report` (plan parts `01` and `02`) decided `fix` for the parse blocker and the `amt` rename, both in `src/parse.js`, and `defer` and `accept` for the others
- **THEN** `round-1/fixes/parts/03.md` exists with `id: "03"`, `isolation: shared`, `src/parse.js` in `files`, a task per fixed finding naming its id, no task for the deferred or accepted findings, and `fixes/index.md` names part `03` for both

#### Scenario: Missing test of present behaviour

- **WHEN** round 1 of `add-total` (plan part `01`) decided `fix` for the finding that scenario `Empty ledger` has no test, and `tally total` already prints `Total: 0.00` for an empty ledger
- **THEN** `round-1/fixes/parts/02.md` lists `tally` / `Requirement: Total` / `Scenario: Empty ledger (behaviour present)` under `## Acceptance scenarios`, its task names the finding id and a test file, and no task changes `bin/tally.js`

#### Scenario: Error message missing from the delta

- **WHEN** round 1 of `add-total` decided `fix` for a `spec-conformance` finding on `openspec/changes/add-total/specs/tally/spec.md` saying no delta lists the error `tally: not an amount: <text>` that the proposal asks for
- **THEN** a fix part lists `openspec/changes/add-total/specs/tally/spec.md` in `files` with a task naming the finding, and `fixes/index.md` holds `- None.` under `## Not planned`

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round`, `plan-fixes-present-behaviour` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage), `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits) and `auto-review-present-behaviour` (from round 1 of `add-total` on the fixture `tally-total-untested.sh`, triaged with the `fix` decision for the missing `Empty ledger` test, a budget of two rounds). `auto-review-first-round` SHALL grade that no `Agent` call starting a worker of the round (`bdk:reviewer`, `bdk:verifier`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`) lacks `run_in_background: false`, and, with the graders `verifier-in-round` and `conformance-written`, that the lead starts `bdk:verifier` for `spec-conformance` with `--round` and that `round-1/spec-conformance.md` exists. It SHALL also grade that the lead starts `bdk:integration-reviewer` in the same message as `bdk:e2e-tester`, so the integration reviewer never starts after the E2E tester has returned.

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
