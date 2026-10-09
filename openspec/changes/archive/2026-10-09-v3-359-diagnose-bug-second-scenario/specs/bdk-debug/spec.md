## MODIFIED Requirements

### Requirement: Fix Change

After a reproduction, `diagnose-bug` SHALL find the root cause in the code and write the fix Change with `openspec new change <change> --schema bdk`: `proposal.md` (the bug and its report under Why, the fix under What Changes, the capability); a spec delta holding a scenario that states the expected behaviour of the reproduction with its exact input (an existing requirement copied whole under `MODIFIED` with the scenario added, or the scenario already there kept, or an `ADDED` requirement when no main spec covers the behaviour); `design.md` with the reproduction, the root cause with its file and line, the fix decision and the call sites the fix reaches; and `plan/parts/01.md` in the plan part format (`isolation: shared`, `depends-on: []`, `files` with the code and the test file) whose only acceptance scenario is the reproduction scenario and whose tasks name the test that reproduces the bug; no task SHALL only pin behaviour that already works, since its test cannot be seen red. The part SHALL pass `bdk plan check`. It SHALL write `debug/diagnosis.md` with `Status: ready`, the Change, the root cause and the part. A related defect the diagnosis finds besides the reproduced bug (another bug, or data the bug already wrote that the fix of the cause does not repair) SHALL NOT enter the Change: no acceptance scenario, task, spec scenario or fix decision covers it. `diagnose-bug` SHALL name each one on its own `Related:` line of `debug/diagnosis.md` and under Risks in `design.md` as related and not fixed, and in its reply, so that it can get its own Change.

#### Scenario: Fix Change of a reproduced bug

- **WHEN** `diagnose-bug` reproduces the crash of `tally total` caused by `add` storing the amount as text
- **THEN** `openspec/changes/fix-<slug>/` holds `proposal.md`, a spec delta under `specs/tally/` with a scenario that adds `5` and expects `Total: 5.00`, `design.md` naming `bin/tally.js`, and `plan/parts/01.md` listing `bin/tally.js` and a test file; `debug/diagnosis.md` starts with `Status: ready`

#### Scenario: Fix too large for one part

- **WHEN** the root cause needs a change beyond `plan.part.max-tasks` or `plan.part.max-files`, or a decision between designs the user should make
- **THEN** `diagnose-bug` writes the proposal, the spec delta and `design.md` but no plan part, `debug/diagnosis.md` starts with `Status: too-large`, and `/bdk:debug` stops naming `/bdk:design <change>`

#### Scenario: Only the reproduction is an acceptance scenario

- **WHEN** `diagnose-bug` writes the part of the tally crash, and the main spec also holds the scenario "Empty ledger", which passes today
- **THEN** `plan/parts/01.md` lists one acceptance scenario, the reproduction, and no task adds a test for "Empty ledger"

#### Scenario: A related defect is named, not fixed

- **WHEN** `diagnose-bug` writes the fix of the tally crash and the report says the user's ledgers already hold amounts written as text
- **THEN** `plan/parts/01.md` lists one acceptance scenario, the reproduction, the spec delta holds no scenario for a ledger with text amounts, and `debug/diagnosis.md` holds a `Related:` line naming those ledgers

### Requirement: Gate

After `Status: ready`, `/bdk:debug` SHALL apply `policy.gates.design`: `auto` goes on without asking; `manual` (the default) SHALL ask the user once whether to fix as the diagnosis says, naming the root cause, the reproduction scenario, the part and each `Related:` line of the diagnosis as not fixed, and SHALL commit nothing and start nothing until approved. Without `AskUserQuestion` it SHALL ask in its reply and end its turn. An approval SHALL be written to `debug/gate.md` (`Gate: approved`, `By: user` or `By: policy.gates.design auto`).

#### Scenario: Manual gate

- **WHEN** `/bdk:debug` runs with `policy.gates.design` unset and the diagnosis is ready
- **THEN** the reply names the root cause and asks whether to fix, no commit is made, no `bdk:lead` starts, and `debug/gate.md` does not exist

### Requirement: Debug result and resume

`/bdk:debug` SHALL write `.bdk/runs/<change>/debug/result.md`, replacing an earlier one: the first line `Status: done` (the fix is built and the review result is `Status: done`) or `Status: blocked`; then `## Bug` (the report in one line, the reproduction, the root cause and one `Related:` line, marked not fixed, for each `Related:` line of `debug/diagnosis.md`), `## Fix` (the reproduction test, the changed files, the commits), `## Review` (the first line of `review/result.md` and its rounds), `## Blockers` and `## Decisions taken without the user`, an empty section holding `- None.` It SHALL reply with the status line, the path, and on `Status: done` the next step `/bdk:close <change>`. Started again with the Change name, it SHALL resume from the first missing file: `debug/diagnosis.md`, `debug/gate.md`, the commit of the Change, `execute/result.md`, `review/result.md`, `debug/result.md`.

#### Scenario: Resume after the fix

- **WHEN** `/bdk:debug fix-total-crash` runs and `debug/gate.md`, a committed Change and `execute/result.md` with `Status: done` exist, but no `review/result.md`
- **THEN** it starts with `auto-review fix-total-crash` and runs neither `diagnose-bug` nor `execute`

### Requirement: Eval cases of debug

The suite SHALL hold the block cases `diagnose-bug-reproduced`, `diagnose-bug-related-defect` (the report names ledgers the bug already wrote: one acceptance scenario, a `Related:` line) and `diagnose-bug-not-reproduced`, and the orchestrator cases `debug-fix` (auto gate, the bug reproduced, fixed with a test, the fix Change reviewed), `debug-manual-gate` (the run stops at the gate), `debug-too-large` (the fix does not fit one plan part: no part, `Status: too-large`, the run stops naming `/bdk:design`) and `debug-resume-review` (a run resumed after `execute` starts at `auto-review`), on a shared fixture of a configured project with a seeded bug.

#### Scenario: Acceptance signal

- **WHEN** `debug-fix` runs with the plugin
- **THEN** its graders pass: the reproduction test is seen red and then green in `execute/part-01.md`, the fixed product prints the expected output, and `debug/result.md` exists

#### Scenario: Too large is covered

- **WHEN** `debug-too-large` runs with the plugin on the tally crash with `plan.part.max-files: 1`
- **THEN** its graders pass: `openspec/changes/fix-total-crash/` holds `proposal.md` and `design.md` but no `plan/parts/01.md`, `debug/diagnosis.md` starts with `Status: too-large` and names `/bdk:design fix-total-crash`, no `debug/gate.md` exists, no `commit`, `execute` or `auto-review` Skill call is made, and `bin/tally.js` is unchanged

#### Scenario: Resume is covered

- **WHEN** `debug-resume-review` runs `/bdk:debug fix-total-crash` with `debug/gate.md`, the committed Change and fix, and `execute/result.md` with `Status: done`, but no `review/result.md`
- **THEN** its graders pass: an `auto-review` Skill call follows `/bdk:debug`, no `diagnose-bug` or `execute` Skill call is made, `review/result.md` exists, and `debug/result.md` carries the part report's `red seen; green seen` line under `## Fix`

#### Scenario: Related defect is covered

- **WHEN** `diagnose-bug-reproduced` and `diagnose-bug-related-defect` each run 9 times with the plugin
- **THEN** the grader `one-acceptance-scenario` passes in every run of both, and `diagnosis-names-related` passes in every run of `diagnose-bug-related-defect`
