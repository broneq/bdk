# kernel-loops delta

## MODIFIED Requirements

### Requirement: Escalation ladder

The kernel SHALL walk every loop through narrowed attempts, one optional escalation and the end of the ladder, and SHALL tell the orchestrator the next rung at every `attempt close`.

`attempt close` returns `next.action`:

| Outcome and state                                                                                                           | `next.action`                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ok`                                                                                                                        | `commit`                                                |
| `not-run`, `not-run` budget left                                                                                            | `retry` (same scope)                                    |
| `fail`, budget left, no oscillation                                                                                         | `narrow` with the next scope                            |
| `fail` with budget used up or oscillation, escalation available                                                             | `escalate`                                              |
| `fail` of the escalation ticket, or budget used up or oscillation with no escalation available, or `not-run` budget used up | `parked` with the question entry and the resume command |

An `ok` close has already run the post-task steps under its ticket (`kernel-cli/attempt`, `attempt close`; T23-D41), so the orchestrator commits the task next.

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
