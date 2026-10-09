## MODIFIED Requirements

### Requirement: Skills

The `bdk` plugin SHALL ship the skills `debug` (`skills/debug/`, the user command `/bdk:debug`) and `diagnose-bug` (`skills/diagnose-bug/`), both running in the main thread. `diagnose-bug` SHALL never edit product code or tests. `/bdk:debug` SHALL reproduce, diagnose, test, fix and review nothing itself: it SHALL invoke `diagnose-bug`, `commit`, `execute` and `auto-review` with the Skill tool and apply the gate. The reply that ends a block it invoked SHALL end that block only: `/bdk:debug` SHALL go on with its next step in the same turn and stop only where its own steps say to stop. Its description SHALL route a reported symptom (an error, a crash, unexpected behaviour) to `/bdk:debug` also when the fix may turn out to be one line.

#### Scenario: Debug composes blocks

- **WHEN** `/bdk:debug "tally total crashes after tally add 5"` runs in a configured project and the bug is reproduced
- **THEN** the trace shows the Skill calls `diagnose-bug`, then `commit`, then `execute`, then `auto-review`, and no `Edit` or `Write` of `bin/` or `test/` by the main conversation

#### Scenario: Diagnosis reply does not end the run

- **WHEN** `diagnose-bug` ends with its reply and `debug/diagnosis.md` reads `Status: ready` under `policy.gates.design: auto`
- **THEN** in the same turn `/bdk:debug` writes `debug/gate.md` and invokes `commit`

#### Scenario: A one-line fix of a reported crash

- **WHEN** the user reports in a configured project that `tally total` crashes with `TypeError: total.toFixed is not a function` after `tally add 5`, and asks to fix it
- **THEN** the session invokes `/bdk:debug`, and no `Edit` of `bin/tally.js` comes before it

### Requirement: Fix Change

After a reproduction, `diagnose-bug` SHALL find the root cause in the code and write the fix Change with `openspec new change <change> --schema bdk`: `proposal.md` (the bug and its report under Why, the fix under What Changes, the capability); a spec delta holding a scenario that states the expected behaviour of the reproduction with its exact input (an existing requirement copied whole under `MODIFIED` with the scenario added, or the scenario already there kept, or an `ADDED` requirement when no main spec covers the behaviour); `design.md` with the reproduction, the root cause with its file and line, the fix decision and the call sites the fix reaches; and `plan/parts/01.md` in the plan part format (`isolation: shared`, `depends-on: []`, `files` with the code and the test file) whose only acceptance scenario is the reproduction scenario and whose tasks name the test that reproduces the bug; no task SHALL only pin behaviour that already works, since its test cannot be seen red. The part SHALL pass `bdk plan check`. It SHALL write `debug/diagnosis.md` with `Status: ready`, the Change, the root cause and the part.

#### Scenario: Fix Change of a reproduced bug

- **WHEN** `diagnose-bug` reproduces the crash of `tally total` caused by `add` storing the amount as text
- **THEN** `openspec/changes/fix-<slug>/` holds `proposal.md`, a spec delta under `specs/tally/` with a scenario that adds `5` and expects `Total: 5.00`, `design.md` naming `bin/tally.js`, and `plan/parts/01.md` listing `bin/tally.js` and a test file; `debug/diagnosis.md` starts with `Status: ready`

#### Scenario: Fix too large for one part

- **WHEN** the root cause needs a change beyond `plan.part.max-tasks` or `plan.part.max-files`, or a decision between designs the user should make
- **THEN** `diagnose-bug` writes the proposal, the spec delta and `design.md` but no plan part, `debug/diagnosis.md` starts with `Status: too-large`, and `/bdk:debug` stops naming `/bdk:design <change>`

#### Scenario: Only the reproduction is an acceptance scenario

- **WHEN** `diagnose-bug` writes the part of the tally crash, and the main spec also holds the scenario "Empty ledger", which passes today
- **THEN** `plan/parts/01.md` lists one acceptance scenario, the reproduction, and no task adds a test for "Empty ledger"

### Requirement: Eval cases of debug

The suite SHALL hold the block cases `diagnose-bug-reproduced` and `diagnose-bug-not-reproduced`, and the orchestrator cases `debug-fix` (auto gate, the bug reproduced, fixed with a test, the fix Change reviewed), `debug-manual-gate` (the run stops at the gate), `debug-too-large` (the fix does not fit one plan part: no part, `Status: too-large`, the run stops naming `/bdk:design`) and `debug-resume-review` (a run resumed after `execute` starts at `auto-review`), on a shared fixture of a configured project with a seeded bug.

#### Scenario: Acceptance signal

- **WHEN** `debug-fix` runs with the plugin
- **THEN** its graders pass: the reproduction test is seen red and then green in `execute/part-01.md`, the fixed product prints the expected output, and `debug/result.md` exists

#### Scenario: Too large is covered

- **WHEN** `debug-too-large` runs with the plugin on the tally crash with `plan.part.max-files: 1`
- **THEN** its graders pass: `openspec/changes/fix-total-crash/` holds `proposal.md` and `design.md` but no `plan/parts/01.md`, `debug/diagnosis.md` starts with `Status: too-large` and names `/bdk:design fix-total-crash`, no `debug/gate.md` exists, no `commit`, `execute` or `auto-review` Skill call is made, and `bin/tally.js` is unchanged

#### Scenario: Resume is covered

- **WHEN** `debug-resume-review` runs `/bdk:debug fix-total-crash` with `debug/gate.md`, the committed Change and fix, and `execute/result.md` with `Status: done`, but no `review/result.md`
- **THEN** its graders pass: an `auto-review` Skill call follows `/bdk:debug`, no `diagnose-bug` or `execute` Skill call is made, `review/result.md` exists, and `debug/result.md` carries the part report's `red seen; green seen` line under `## Fix`
