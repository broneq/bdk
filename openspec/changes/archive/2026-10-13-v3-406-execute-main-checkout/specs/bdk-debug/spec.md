## MODIFIED Requirements

### Requirement: Fix Change

After a reproduction, `diagnose-bug` SHALL find the root cause in the code and write the fix Change with `openspec new change <change> --schema bdk`: `proposal.md` (the bug and its report under Why, the fix under What Changes, the capability); a spec delta holding a scenario that states the expected behaviour of the reproduction with its exact input (an existing requirement copied whole under `MODIFIED` with the scenario added, or the scenario already there kept, or an `ADDED` requirement when no main spec covers the behaviour); `design.md` with the reproduction, the root cause with its file and line, the fix decision and the call sites the fix reaches; and `plan/parts/01.md` in the plan part format (`depends-on: []`, `files` with the code and the test file) whose only acceptance scenario is the reproduction scenario and whose tasks name the test that reproduces the bug; no task SHALL only pin behaviour that already works, since its test cannot be seen red. The part SHALL pass `bdk plan check`. It SHALL write `debug/diagnosis.md` with `Status: ready`, the Change, the root cause and the part. A related defect the diagnosis finds besides the reproduced bug (another bug, or data the bug already wrote that the fix of the cause does not repair) SHALL NOT enter the Change: no acceptance scenario, task, spec scenario or fix decision covers it. `diagnose-bug` SHALL name each one on its own `Related:` line of `debug/diagnosis.md` and under Risks in `design.md` as related and not fixed, and in its reply, so that it can get its own Change.

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

