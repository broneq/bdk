## MODIFIED Requirements

### Requirement: Fix parts

`plan-fixes <round dir>` SHALL read the findings of the round whose latest decision is `fix` and write fix parts `<round dir>/fixes/parts/NN.md` in the plan part format (`id`, `depends-on: []`, `isolation`, `files`; goal, acceptance scenarios, tasks with `File`, `Interface` and `Verified by`), one task per finding, each task naming its finding id. Ids SHALL continue after the highest part id of the plan and of every earlier round's fix parts. Findings on the same file SHALL be in the same part; parts SHALL keep to `plan.part.max-tasks` and `plan.part.max-files`; one part SHALL be `shared`, several parts SHALL have disjoint files and be `worktree`. A finding that breaks a spec scenario SHALL list that scenario as an acceptance scenario. A finding that asks for a test of a spec scenario whose behaviour the code already has (traced in the code to the scenario's THEN) SHALL list that scenario as an acceptance scenario with the suffix ` (behaviour present)`, and its task's `Verified by:` SHALL say that the new test passes at its first run; a finding asking for such a test of behaviour the code does not have SHALL list the scenario without the suffix. The block SHALL check the parts with `bdk plan check <round dir>/fixes/parts` and fix what it reports. It SHALL write `<round dir>/fixes/index.md` naming each `fix` finding's part, and under `## Not planned` each finding it cannot plan as a fix (its fix needs a spec or design change, or its cause cannot be found) with the reason. It SHALL change no project file.

#### Scenario: Two findings on one file

- **WHEN** round 1 of `monthly-report` (plan parts `01` and `02`) decided `fix` for the parse blocker and the `amt` rename, both in `src/parse.js`, and `defer` and `accept` for the others
- **THEN** `round-1/fixes/parts/03.md` exists with `id: "03"`, `isolation: shared`, `src/parse.js` in `files`, a task per fixed finding naming its id, no task for the deferred or accepted findings, and `fixes/index.md` names part `03` for both

#### Scenario: Missing test of present behaviour

- **WHEN** round 1 of `add-total` (plan part `01`) decided `fix` for the finding that scenario `Empty ledger` has no test, and `tally total` already prints `Total: 0.00` for an empty ledger
- **THEN** `round-1/fixes/parts/02.md` lists `tally` / `Requirement: Total` / `Scenario: Empty ledger (behaviour present)` under `## Acceptance scenarios`, its task names the finding id and a test file, and no task changes `bin/tally.js`

### Requirement: Eval cases of the review stage

The suite SHALL hold the block cases `plan-fixes-judged-round`, `plan-fixes-present-behaviour` and `triage-last-round`, and the orchestrator cases `auto-review-first-round` (one round end to end on the `monthly-report` fixture, manual triage), `auto-review-fix-round` (from the judged round in auto mode: triage, fix parts, the fix pass and a second round whose `groups.json` covers only the fix commits) and `auto-review-present-behaviour` (from round 1 of `add-total` on the fixture `tally-total-untested.sh`, triaged with the `fix` decision for the missing `Empty ledger` test, a budget of two rounds). `auto-review-first-round` SHALL grade that no `Agent` call starting a worker of the round (`bdk:reviewer`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`) lacks `run_in_background: false`.

#### Scenario: Acceptance signal

- **WHEN** `auto-review-fix-round` runs with the plugin
- **THEN** its graders pass: `round-1/fixes/result.md` reads `Status: done`, `round-2/groups.json` is anchored on round 1 and holds only files of the fix commits, and `round-2/review.md` exists

#### Scenario: Round workers start in the foreground

- **WHEN** `auto-review-first-round` runs with the plugin
- **THEN** its foreground grader passes: every `Agent` call of the lead that starts a reviewer, the integration reviewer, the E2E tester or the judge carries `"run_in_background": false`

#### Scenario: A fix part that only adds a test is built and committed

- **WHEN** `auto-review-present-behaviour` runs with the plugin
- **THEN** its graders pass: fix part `02` lists `Empty ledger` with ` (behaviour present)`, `round-1/fixes/state.json` has part `02` `done` and `round-1/fixes/result.md` reads `Status: done` (the lead committed the part), and `execute/part-02.md` starts with `Status: done` and its line for the scenario ends `; green at first run (behaviour present); green seen`
