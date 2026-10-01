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

`not-run` is not a loop: it is a counter per loop and target with the budget `policy.budgets.not-run` (default 3). A round of a loop and target is the set of its attempt records that no answered ladder question names: the ladder question's `refs` name the tickets of the round it ends, and a `decision` entry whose `refs` name the question answers it (see "Escalation ladder"); the first round starts with the Change. Naming the tickets, not comparing times, keeps two rounds apart when a close, the answer and the next open fall in the same second. Within a round: `attempt` is one more than the number of `ok` and `fail` records that are not escalations; `of` is the loop's budget; the `not-run` counter is the number of `not-run` records since the latest `ok` or `fail` record. A budget of 0 allows no plain attempt. An answered ladder question is the only way a new round starts, so a budget never resets without a `decision` entry.

#### Scenario: counts from records

- **WHEN** `task-redispatch 02-3` has two `fail` records and one `not-run` record in its round and `bdk attempt list --for 02-3 --json` runs
- **THEN** `budgets.task-redispatch` is `{used: 2, of: 3}` and `budgets.not-run` is `{used: 1, of: 3}`

#### Scenario: an answer opens a new round

- **WHEN** the round of `task-redispatch 02-3` ended with a ladder question and `bdk change resume <id> --option 1` recorded the answer
- **THEN** `bdk attempt open task-redispatch 02-3` exits 0 with `attempt: 1` and `scope: full`

#### Scenario: fresh clone gives the same counts

- **WHEN** the attempt records of a Change are committed, `.bdk/.machine/` is deleted, `bdk change resume <id>` binds the Change to the branch again and `bdk attempt list --json` runs
- **THEN** the output equals the output before the deletion

### Requirement: Escalation ladder

The kernel SHALL walk every loop through narrowed attempts, one optional escalation and the end of the ladder, and SHALL tell the orchestrator the next rung at every `attempt close`.

`attempt close` returns `next.action`:

| Outcome and state                                                                                                           | `next.action`                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ok` of a `part-lead` ticket                                                                                                | `part-done`                                             |
| `ok` of any other ticket                                                                                                    | `commit`                                                |
| `not-run`, `not-run` budget left                                                                                            | `retry` (same scope)                                    |
| `fail`, budget left, no oscillation                                                                                         | `narrow` with the next scope                            |
| `fail` with budget used up or oscillation, escalation available                                                             | `escalate`                                              |
| `fail` of the escalation ticket, or budget used up or oscillation with no escalation available, or `not-run` budget used up | `parked` with the question entry and the resume command |

An `ok` close has already run the post-task steps under its ticket (`kernel-cli/attempt`, `attempt close`; T23-D41), so the orchestrator commits the task next. A `part-lead` ticket is the lead of one plan part (T41-D11): its lead opens, dispatches, closes and commits the part's task tickets itself, so its `ok` close requires every task ticket of the part to be closed (`policy/ticket-open` otherwise) and runs no post-task steps of its own, and the orchestrator runs `part done` next. A `fail` or `not-run` of a `part-lead` ticket walks the same ladder; the next lead of the part finds the committed tasks through their trailers and continues with the rest.

Escalation is available when `policy.escalation.enabled` is true, the round has no escalation ticket and the Change has fewer than `policy.escalation.per-change` escalation tickets. A plain `attempt open` refuses with `policy/budget-exhausted` when the round's budget is used up and with `policy/oscillation` when the round oscillates; `instead` names `attempt open <loop> <target> --escalate` when escalation is available and `change resume` when the Change is parked.

#### Scenario: budget exhaustion parks the Change

- **WHEN** `policy.budgets.task-redispatch` is 2, `policy.escalation.enabled` is false, and two tickets of `task-redispatch 02-3` close `fail`
- **THEN** the second `attempt close` returns `next.action: parked`, the ledger holds one `question` entry with `park: true`, `review: true`, `source: kernel`, at least two `options` and `refs` naming `02-3`, `change status` shows the Change parked with the single resume command, and `bdk attempt open task-redispatch 02-3` exits 2 with `rule: policy/budget-exhausted`

#### Scenario: escalation before parking

- **WHEN** escalation is enabled and the budget of `task-redispatch 02-3` is used up
- **THEN** the last `attempt close` returns `next.action: escalate`, `attempt open task-redispatch 02-3 --escalate` exits 0 with `escalation.model` from `policy.escalation.model`, and a `fail` close of that ticket returns `next.action: parked`

#### Scenario: ok gives commit

- **WHEN** a code ticket with fresh cited step evidence closes `ok`
- **THEN** `next.action` is `commit`

#### Scenario: failing tests walk the ladder

- **WHEN** the runner recorded `tests-scoped` with verdict `fail` and the orchestrator closes the ticket `fail` with budget left
- **THEN** `next.action` is `narrow` and the next ticket of the task starts a new implementer package

#### Scenario: lead ticket closes to part-done

- **WHEN** every task ticket of part `02` is closed and the `part-lead` ticket of `02` closes `ok`
- **THEN** `next.action` is `part-done`

#### Scenario: lead ticket with an open task ticket

- **WHEN** a task ticket of part `02` is open and `bdk attempt close <part-lead ticket> ok` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/ticket-open` naming the task ticket, and the lead ticket stays open
