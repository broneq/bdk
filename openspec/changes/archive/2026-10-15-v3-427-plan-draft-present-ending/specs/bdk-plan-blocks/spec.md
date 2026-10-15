## MODIFIED Requirements

### Requirement: plan-draft marks the scenarios whose behaviour is present

For every scenario of the Change's spec deltas, `plan-draft` SHALL trace the scenario's WHEN through the code as it is before the Change to the output, and SHALL decide by reading the code, not by running tests. A scenario whose THEN the code already gives completely SHALL be listed in the acceptance scenarios of its part with the suffix ` (behaviour present)` after the scenario name, and the task that adds its test SHALL give it a `Verified by:` line of its own that names it and its test and ends `; it passes at its first run, the behaviour is present`, with nothing after the ending. A task that tests present scenarios next to others SHALL hold one `Verified by:` line for the others, without the ending, and one per present scenario. `plan-draft` SHALL run `bdk plan check` and fix every `present-scenario` problem it lists. A scenario the code does not satisfy, or satisfies only in part, SHALL NOT carry the suffix. What an earlier part of the same plan will build SHALL NOT count as present. A scenario SHALL be assigned to the part that owns the code or the test file it concerns; a part that holds only present scenarios SHALL be written only when no other part owns that code or test file.

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

#### Scenario: Task that tests present and new scenarios

- **WHEN** one task adds the tests of `Add an expense`, which is new, and of `Bad amount` and `Unknown command`, whose behaviour is present
- **THEN** the task holds a `Verified by:` line naming `Add an expense` without the ending, and one line for each of `Bad amount` and `Unknown command`, each ending `; it passes at its first run, the behaviour is present`, and `bdk plan check` reports no `present-scenario` problem
