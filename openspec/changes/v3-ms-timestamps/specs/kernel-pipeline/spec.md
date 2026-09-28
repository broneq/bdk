# kernel-pipeline delta

## MODIFIED Requirements

### Requirement: Gate

A gate node SHALL be done only when the ledger holds a `transition` entry whose `gate` is the node id, whose `source` is `user` (or `policy` while the gate's `policy.gates.<gate>` resolves to `auto`), and whose `at` is not earlier than the gate's ready time (both truncated to the second, so a transition of the ready second counts, whatever its milliseconds); the kernel SHALL never mark a gate done itself.

The ready time is the latest `at` among the `done` transitions that currently make the gate's requirements done; a gate whose requirements were never all done has none and is not done. The gate checks provenance and timing only: no content, no hash, no approval record. Entries of any other type, and transitions with another `source`, never pass a gate, whatever their summary says. `bdk done gate:<stage>` refuses with `policy/gate-not-ready`. A gate's status shows `ready`, `done`, `passedBy` (`user` or `policy`), the `command` from the stage its `opens` names, and the pending entries: live entries with `review: true`, newest first.

#### Scenario: user transition passes the gate

- **WHEN** `design` and `architecture` are done and a fixture inserts a `transition` with `gate: gate:design`, `to: plan` and `source: user` after them
- **THEN** `gate:design` is done with `passedBy: user` and `next` returns `plan`

#### Scenario: faked approval

- **WHEN** `bdk log add decision "Design approved" --ref gate:design` runs while `gate:design` is ready
- **THEN** `gate:design` stays ready and not done, and `next` still waits for the gate

#### Scenario: loop-back needs a newer entry

- **WHEN** `gate:design` was passed by a user transition, `design.md` is then changed and `bdk done design` records the new hash
- **THEN** `gate:design` is ready and not done until a user transition later than that `done` entry exists

#### Scenario: auto gate

- **WHEN** `policy.gates.design` resolves to `auto` and the ledger holds a `transition` with `gate: gate:design` and `source: policy` after the gate became ready
- **THEN** `gate:design` is done with `passedBy: policy`

#### Scenario: manual gate ignores policy entries

- **WHEN** `policy.gates.design` resolves to `manual` and the only transition naming the gate has `source: policy`
- **THEN** `gate:design` is not done

#### Scenario: early entry does not count

- **WHEN** a user transition naming `gate:design` is older than the `done` entry of `design`
- **THEN** `gate:design` is ready and not done

#### Scenario: transition of the ready second

- **WHEN** the gate became ready at `2026-09-25T09:41:07.800Z` and the user's `transition` has `at: 2026-09-25T09:41:07Z`
- **THEN** the gate is done
