## ADDED Requirements

### Requirement: plan-draft marks the scenarios whose behaviour is present

For every scenario of the Change's spec deltas, `plan-draft` SHALL trace the scenario's WHEN through the code as it is before the Change to the output, and SHALL decide by reading the code, not by running tests. A scenario whose THEN the code already gives completely SHALL be listed in the acceptance scenarios of its part with the suffix ` (behaviour present)` after the scenario name, and the `Verified by:` line of the task that adds its test SHALL end `; it passes at its first run, the behaviour is present`. A scenario the code does not satisfy, or satisfies only in part, SHALL NOT carry the suffix. What an earlier part of the same plan will build SHALL NOT count as present. A scenario SHALL be assigned to the part that owns the code or the test file it concerns; a part that holds only present scenarios SHALL be written only when no other part owns that code or test file.

#### Scenario: Unchanged scenarios of a modified requirement are marked

- **WHEN** the delta MODIFIES requirement `Total` of a CLI whose code already prints `Total: 0.00` for an empty ledger, and the requirement keeps the scenario `Empty ledger` next to a new scenario `Count flag`
- **THEN** the part lists `Empty ledger (behaviour present)` and `Count flag` without the suffix, and the task of `Empty ledger` has `Verified by:` ending `; it passes at its first run, the behaviour is present`

#### Scenario: Scenario the code satisfies in part is not marked

- **WHEN** a kept scenario says the usage line names `tally total` and the code prints a usage line without it
- **THEN** the scenario is listed without the suffix

#### Scenario: Scenario built by an earlier part is not marked

- **WHEN** part `01` adds a function and the scenario that part `02` tests needs it
- **THEN** the scenario is listed without the suffix

#### Scenario: Present scenarios join the part that owns their test file

- **WHEN** two scenarios are present and the part that adds the new scenarios of the same requirement edits their test file
- **THEN** both are listed in that part and no part holding only them is written

### Requirement: verify-plan checks the markers of present scenarios

`verify-plan` SHALL, for each scenario a part lists, trace its WHEN through the code as it is before the Change, and SHALL put into `Must address` a scenario that the code already satisfies completely and the part lists without the suffix ` (behaviour present)`, and a scenario listed with the suffix that the code does not satisfy completely. The item SHALL name the scenario and the part, with the code location as evidence.

#### Scenario: Present scenario left unmarked

- **WHEN** part `01` lists `Empty ledger` without the suffix and the code prints `Total: 0.00` for an empty ledger
- **THEN** the report starts with `Verdict: FAIL` and a `Must address` item names `Empty ledger` and part `01`

#### Scenario: Missing behaviour marked as present

- **WHEN** a part lists `Count flag (behaviour present)` and the code has no `--count` option
- **THEN** a `Must address` item names `Count flag` and part `01`

#### Scenario: Every marker right

- **WHEN** the scenarios the code satisfies carry the suffix and the others do not
- **THEN** no item of `Must address` is about a marker

### Requirement: Eval cases of present scenarios

The `bdk` eval suite SHALL hold the `block` cases `plan-draft-present-scenarios` and `verify-plan-present-scenarios` on the fixture `tally-modified.sh`, a configured project whose Change MODIFIES two existing requirements and keeps scenarios the code satisfies. The first SHALL grade that the written parts mark exactly the present scenarios; the second SHALL grade that a plan with one present scenario left unmarked and one missing behaviour marked fails with an item for each. The measured with and without results SHALL be recorded in the Change's design.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** both cases load with no error at zero cost and their scaffolds exit 0
