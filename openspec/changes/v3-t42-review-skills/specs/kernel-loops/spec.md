## MODIFIED Requirements

### Requirement: Diff check

The kernel SHALL compare the real working-tree diff with the plan at `attempt close` and `commit`, never with the envelope's file list (P6).

The touched paths are the working tree's changes, untracked files included; a path whose whole change is staged is the user's (main-thread git, T3) and left out, so neither check nor commit sweeps it in; `.bdk/` is excluded, and `.gitignore` excluded while it differs from `HEAD` only by the lines of `kernel-state`, Ignored paths (the kernel's own edit at `change new`). For a task target the declared paths are the task's `Files:` and the forbidden globs the part's `do-not-touch`; for a part target the union of its tasks' `Files:` and its `do-not-touch`; for the Change target (a `review-fix` ticket) every touched path as declared and the `do-not-touch` of every started part, so nothing is reported undeclared, because a review fix may touch any path the review names (T42); a `verifier` target is not checked. A touched path that the target does not declare and another task of a started part without a trailer commit does declare is that task's work in flight: parts run in parallel in one working tree, so it is neither checked against the forbidden globs nor reported, and `commit` leaves it to its task. Any other touched path matching a forbidden glob refuses with `policy/do-not-touch` naming the path and the glob. A touched path that is not declared by the target and not declared by another task of a started part without a trailer commit is undeclared: it is reported in `diff.undeclared` and recorded as one kernel `finding` naming the paths.

#### Scenario: do-not-touch at attempt close

- **WHEN** part `02` declares `do-not-touch: [src/billing/**]`, ticket `A-xxxxxxxx` of `task-redispatch 02-3` is open and the working tree changes `src/billing/invoice.ts`
- **THEN** `attempt close A-xxxxxxxx ok` exits 2 with `rule: policy/do-not-touch` naming `src/billing/invoice.ts` and `src/billing/**`, and the record stays open

#### Scenario: undeclared file

- **WHEN** task `02-3` declares `src/auth/login.ts` and the working tree also changes `src/auth/util.ts`, which no other task declares
- **THEN** `attempt close` exits 0 with `diff.undeclared: [src/auth/util.ts]` and a kernel `finding` naming the path

#### Scenario: sibling task's file

- **WHEN** tasks `02-3` and `02-4` run in one wave and the working tree changes a file only `02-4` declares
- **THEN** the diff check of `02-3` does not report it as undeclared

#### Scenario: another part's work in flight

- **WHEN** parts `01` and `02` are started, part `01` declares `do-not-touch: [src/api/**]`, task `02-1` declares `src/api/http.ts` and has no trailer commit, and the working tree changes `src/ui/format.ts` of task `01-1` and `src/api/http.ts`
- **THEN** `commit 01-1` exits 0 and commits `src/ui/format.ts` only, and `src/api/http.ts` stays in the working tree for `02-1`

#### Scenario: review fix touches a file no task declares

- **WHEN** a `review-fix` ticket of the Change is open and the working tree changes `src/util.ts`, which no task declares and no `do-not-touch` matches
- **THEN** `attempt close` and `commit <change-id>` report no `diff.undeclared` and write no kernel `finding`

### Requirement: Progress from git

The kernel SHALL derive task progress from commit trailers and attempt state from committed attempt records, so that a killed session loses at most the uncommitted records (V1-4, S5).

A task is committed when a commit reachable from `HEAD` carries `BDK-Change: <change id>`, `BDK-Part: <part id>` and `BDK-Task: <task id>`. A commit carrying `BDK-Change` and `BDK-Ticket` of a `review-fix` ticket of the Change is a review fix (`kernel-cli/commit`, bdk commit) and commits no task. Trailers and records disagree (`state/trailer-mismatch`, naming both sides) when a `BDK-Task` names a task no part holds, when `BDK-Part` differs from the part holding the task, when a commit carries `BDK-Change` of the Change without the other two trailers and without a `BDK-Ticket` naming a `review-fix` ticket of the Change, or when an attempt record's task target is held by no part.

#### Scenario: killed session and rebuild

- **WHEN** a session committed task `02-1`, closed two attempts of `02-2` and checkpointed, then died with ticket `A-xxxxxxxx` open; the repository is cloned afresh and `bdk change resume <id>` and `bdk rebuild` run
- **THEN** `part list` shows part `02` with `done: 1`, `attempt list --for 02-2` shows the two closed records with their outcomes, the open ticket and the same budgets as before

#### Scenario: trailer names a missing task

- **WHEN** a commit carries `BDK-Task: 02-9` and no part holds `02-9`
- **THEN** `bdk rebuild` exits 4 with `rule: state/trailer-mismatch` naming the commit and the plan

#### Scenario: review fix commit agrees with the records

- **WHEN** the Change has a commit with trailers `BDK-Change` and `BDK-Ticket` naming its closed `review-fix` ticket, and `bdk rebuild` runs
- **THEN** no `state/trailer-mismatch` is raised and no task counts as committed by that commit

### Requirement: Escalation ladder

The kernel SHALL walk every loop through narrowed attempts, one optional escalation and the end of the ladder, and SHALL tell the orchestrator the next rung at every `attempt close`.

`attempt close` returns `next.action`:

| Outcome and state                                                                                                           | `next.action`                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ok` of a `part-lead` ticket                                                                                                | `part-done`                                             |
| `ok` of a `review-fix` ticket                                                                                               | `review-done`                                           |
| `ok` of any other ticket                                                                                                    | `commit`                                                |
| `not-run`, `not-run` budget left                                                                                            | `retry` (same scope)                                    |
| `fail`, budget left, no oscillation                                                                                         | `narrow` with the next scope                            |
| `fail` with budget used up or oscillation, escalation available                                                             | `escalate`                                              |
| `fail` of the escalation ticket, or budget used up or oscillation with no escalation available, or `not-run` budget used up | `parked` with the question entry and the resume command |

An `ok` close has already run the post-task steps under its ticket (`kernel-cli/attempt`, `attempt close`; T23-D41), so the orchestrator commits the task next. A `part-lead` ticket is the lead of one plan part (T41-D11): its lead opens, dispatches, closes and commits the part's task tickets itself, so its `ok` close requires every task ticket of the part to be closed (`policy/ticket-open` otherwise) and runs no post-task steps of its own, and the orchestrator runs `part done` next. A `review-fix` ticket is one review round of the Change (T42): its `ok` close requires the round's merged report (`policy/missing-report` otherwise; a `fail` close needs it too) and means no blocking entry is left, so the orchestrator runs `done review` next; its fixes were committed under the ticket while it was open. A `fail` or `not-run` of a `part-lead` ticket walks the same ladder; the next lead of the part finds the committed tasks through their trailers and continues with the rest.

Escalation is available when `policy.escalation.enabled` is true, the round has no escalation ticket and the Change has fewer than `policy.escalation.per-change` escalation tickets. A plain `attempt open` refuses with `policy/budget-exhausted` when the round's budget is used up and with `policy/oscillation` when the round oscillates; `instead` names `attempt open <loop> <target> --escalate` when escalation is available and `change resume` when the Change is parked. The escalation ticket's agents run on its `model` (`kernel-cli/dispatch`, bdk dispatch build), not on their adapter's tier: the escalation is a stronger model, not only one more attempt (T41-D14).

#### Scenario: budget exhaustion parks the Change

- **WHEN** `policy.budgets.task-redispatch` is 2, `policy.escalation.enabled` is false, and two tickets of `task-redispatch 02-3` close `fail`
- **THEN** the second `attempt close` returns `next.action: parked`, the ledger holds one `question` entry with `park: true`, `review: true`, `source: kernel`, at least two `options` and `refs` naming `02-3`, `change status` shows the Change parked with the single resume command, and `bdk attempt open task-redispatch 02-3` exits 2 with `rule: policy/budget-exhausted`

#### Scenario: escalation before parking

- **WHEN** escalation is enabled and the budget of `task-redispatch 02-3` is used up
- **THEN** the last `attempt close` returns `next.action: escalate`, `attempt open task-redispatch 02-3 --escalate` exits 0 with `escalation.model` from `policy.escalation.model` and records it as the ticket's `model`, and a `fail` close of that ticket returns `next.action: parked`

#### Scenario: ok gives commit

- **WHEN** a code ticket with fresh cited step evidence closes `ok`
- **THEN** `next.action` is `commit`

#### Scenario: failing tests walk the ladder

- **WHEN** the runner recorded `tests-scoped` with verdict `fail` and the orchestrator closes the ticket `fail` with budget left
- **THEN** `next.action` is `narrow` and the next ticket of the task starts a new implementer package

#### Scenario: lead ticket closes to part-done

- **WHEN** every task ticket of part `02` is closed and the `part-lead` ticket of `02` closes `ok`
- **THEN** `next.action` is `part-done`

#### Scenario: review round closes to review-done

- **WHEN** the merged report of a `review-fix` ticket is stored under `<ticket>@merge` and the ticket closes `ok`
- **THEN** `next.action` is `review-done`

#### Scenario: lead ticket with an open task ticket

- **WHEN** a task ticket of part `02` is open and `bdk attempt close <part-lead ticket> ok` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/ticket-open` naming the task ticket, and the lead ticket stays open
