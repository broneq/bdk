## ADDED Requirements

### Requirement: bdk attempt show

One ticket's record: loop, target, state and steps. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt show <ticket>`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket>` (required). The ticket id, as `attempt open` and `attempt list` print it.
- **Behaviour:** Reads the committed `attempts/` record of the ticket, so it is correct on a fresh clone. The output is the item `attempt list` prints for the ticket (`loop`, `target`, `attempt`, `of`, `scope`, `openedAt`, `closedAt` and `outcome` once closed, `escalation`) with `entries`, the ledger entries written under the ticket, and, for the loops that change code (`task-redispatch`, `verify-fix`, `review-fix`), the `steps` that `attempt open` returned. The state is `open` until the ticket has an `outcome`. A ticket the Change does not hold is `input/not-found` with `bdk attempt list` as `instead`. It changes nothing.
- **Writes:** nothing
- **Output:** `schema/cli/output/attempt-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt show A-7f3k9m2q --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "loop": "task-redispatch",
    "target": "02-3",
    "attempt": 2,
    "of": 3,
    "scope": "high+",
    "openedAt": "2026-09-25T10:02:11.482Z",
    "steps": [
      {
        "kind": "simplify",
        "role": "simplifier"
      },
      {
        "kind": "tests-scoped",
        "role": "runner"
      }
    ]
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt show A-7f3k9m2q --json` runs as in the example on an open task ticket
- **THEN** the exit code is 0, stdout validates against `schema/cli/output/attempt-show.json` and holds no `outcome`

#### Scenario: closed ticket

- **WHEN** it runs on a ticket closed `ok`
- **THEN** the output holds `outcome: ok` and `closedAt`

#### Scenario: input/not-found

- **WHEN** it runs on an id the Change does not hold
- **THEN** the exit code is 3, the error object carries `rule: input/not-found` and `instead` holds `bdk attempt list`
