## MODIFIED Requirements

### Requirement: Plan shape for short waves

`plan-draft` SHALL cut the parts so that parts without a dependency between them share a wave: a part names in `depends-on` only the parts whose output it uses, and a contract that several parts use is put into a small early part. A function that a part other than the one adding its feature uses (a pure module a report reuses) SHALL count as such a contract and SHALL be put into a wave-1 part, so no part depends on a feature part only for that function. Work that no other part uses (a command only the user calls, with its tests) SHALL go into a part of a later wave rather than into a part that others depend on, when that does not lengthen the longest chain. The parts run one at a time in the main checkout, so parts of one wave MAY list the same file, and a part SHALL hold no `isolation` key. The plan SHALL have the fewest waves the dependencies allow, since the wave check runs once per wave, and the reply SHALL state the number of waves.

Each part SHALL keep room for the fixes of a verification round: in the final check, no part SHALL exceed seven eighths of `plan.part.max-bytes`.

Before it ends, `plan-draft` SHALL run `bdk plan check` on the parts directory and SHALL fix the parts until it exits 0.

#### Scenario: Check passes

- **WHEN** `plan-draft` has written the parts
- **THEN** `bdk plan check openspec/changes/<change>/plan/parts` exits 0, and the reply states the parts and the waves it reported

#### Scenario: Oversized part split

- **WHEN** `bdk plan check` reports a `max-tasks` problem for part `02`
- **THEN** `plan-draft` splits part `02` and runs the check again until it exits 0

#### Scenario: Shared function in the first wave

- **WHEN** the design of the Change has a reports feature reuse `budgetStatus` of the budgets feature
- **THEN** `budgetStatus` is written in a wave-1 part, and the part of the reports feature does not depend on the part of the budget commands

#### Scenario: Room left in every part

- **WHEN** `plan-draft` has run its final `bdk plan check` on a Change whose foundation work fills a part
- **THEN** no part exceeds seven eighths of `plan.part.max-bytes` (7168 bytes of the default 8192), and work that no other part uses has moved to a part of a later wave or to a second part of the same wave
