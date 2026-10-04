## MODIFIED Requirements

### Requirement: Loops, targets and rounds

The kernel SHALL key every count by a loop and a target, derive every count from the committed attempt records and the ledger, and never store a counter.

| Loop              | Target         | Budget key                       | Default |
| ----------------- | -------------- | -------------------------------- | ------- |
| `task-redispatch` | a task id      | `policy.budgets.task-redispatch` | 3       |
| `verify-fix`      | a part id      | `policy.budgets.verify-fix`      | 2       |
| `review-fix`      | the Change id  | `policy.budgets.review-fix`      | 2       |
| `verifier`        | an artifact id | `policy.budgets.verifier`        | 2       |
| `part-lead`       | a part id      | `policy.budgets.part-lead`       | 2       |

`not-run` is not a loop: it is a counter per loop and target with the budget `policy.budgets.not-run` (default 3). A round of a loop and target is the set of its attempt records that carry the round's `after` and that no answered ladder question names. A round ends in one of two ways. When the latest closed record of the round is `ok`, the round has ended: the next `attempt open` of that loop and target stamps `after: <that ok ticket>` on its record, and so does every later open, until another `ok` ends that round (`kernel-state`, Attempt record). The records of the first round carry no `after`. The other way is a ladder question: the ladder question's `refs` name the tickets of the round it ends, and a `decision` entry whose `refs` name the question answers it (see "Escalation ladder"); the first round starts with the Change. Naming the tickets, not comparing times, keeps two rounds apart when a close, the answer and the next open fall in the same second. Within a round: `attempt` is one more than the number of `ok` and `fail` records that are not escalations; `of` is the loop's budget; the `not-run` counter is the number of `not-run` records since the latest `ok` or `fail` record. A budget of 0 allows no plain attempt. A success or an answered ladder question are the only ways a new round starts, so a budget of failures never resets without an `ok` or a `decision` entry. A `review-fix` ticket opened after a review closed `ok`, as for a `fix` the human chose in the report (`kernel-cli/log`, bdk log decide), therefore runs on the full budget.

#### Scenario: counts from records

- **WHEN** `task-redispatch 02-3` has two `fail` records and one `not-run` record in its round and `bdk attempt list --for 02-3 --json` runs
- **THEN** `budgets.task-redispatch` is `{used: 2, of: 3}` and `budgets.not-run` is `{used: 1, of: 3}`

#### Scenario: an answer opens a new round

- **WHEN** the round of `task-redispatch 02-3` ended with a ladder question and `bdk change resume <id> --option 1` recorded the answer
- **THEN** `bdk attempt open task-redispatch 02-3` exits 0 with `attempt: 1` and `scope: full`

#### Scenario: fresh clone gives the same counts

- **WHEN** the attempt records of a Change are committed, `.bdk/.machine/` is deleted, `bdk change resume <id>` binds the Change to the branch again and `bdk attempt list --json` runs
- **THEN** the output equals the output before the deletion

#### Scenario: an ok ends the round

- **WHEN** `review-fix <change-id>` has a `fail` record and then an `ok` record, and `bdk attempt open review-fix <change-id> --json` runs
- **THEN** the exit code is 0, the output carries `attempt: 1` and `scope: full`, the new record carries `after` naming the `ok` ticket, and `bdk attempt list --json` reports `budgets.review-fix` as `{used: 0, of: 2}`

#### Scenario: a fail does not end the round

- **WHEN** the latest closed record of `review-fix <change-id>` is `fail` after an earlier `ok` round
- **THEN** the next record carries the same `after` as that `fail` record, and its `attempt` is 2
