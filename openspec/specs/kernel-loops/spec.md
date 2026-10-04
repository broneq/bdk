# kernel-loops Specification

## Purpose

The loop model of a Change: how the kernel bounds every retry loop with a budget in state, walks the escalation ladder to a defined end, checks the real diff against the plan, and reconstructs progress from git and committed attempt records (S1, S2, S5, A-drabina, P4, P6, V1-4).

## Requirements

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

### Requirement: Not-run outcome

The kernel SHALL treat `attempt close <ticket> not-run --reason <text>` as a check that could not be performed (P4): it SHALL NOT consume the loop budget, it SHALL advance the round's `not-run` counter, and exhausting `policy.budgets.not-run` SHALL end the ladder at once, without narrowing or escalation.

#### Scenario: three not-run closes

- **WHEN** `policy.budgets.not-run` is 3 and three consecutive tickets of `verifier plan-verify` close `not-run` with a reason
- **THEN** `attempt list` shows `budgets.verifier.used: 0`, the third close returns `next.action: parked`, and the ledger holds one `question` entry with `park: true` whose `refs` name `plan-verify`

#### Scenario: not-run without a reason

- **WHEN** `attempt close A-xxxxxxxx not-run` runs without `--reason`
- **THEN** the exit code is 3 with `rule: input/missing-argument` and the record stays open

### Requirement: Finding fingerprints and oscillation

The kernel SHALL store on a `fail` record the fingerprints of the `finding` and `blocker` entries written under its ticket, and SHALL detect oscillation from them.

A fingerprint is `kernel-state`, Fingerprints, for an attempt finding: the entry type, the path and symbol of the entry's first ref of the form `<path>` or `<path>#<symbol>`, and the normalised summary. An entry with no such ref is not fingerprinted. A round oscillates when one fingerprint appears in `policy.oscillation.threshold` (default 2) `fail` records of the round, consecutive or not. Oscillation shortens the ladder regardless of the remaining budget.

#### Scenario: oscillation shortens the ladder

- **WHEN** `policy.budgets.task-redispatch` is 5 and two tickets of `task-redispatch 02-3` close `fail` with a finding `expired token accepted` on `src/auth/login.ts#verifyToken`, the second worded `Expired token accepted!`
- **THEN** the second close returns `next.action: escalate` with `why` naming the fingerprint, and `attempt open task-redispatch 02-3` exits 2 with `rule: policy/oscillation` although three attempts remain

#### Scenario: different problems do not oscillate

- **WHEN** two `fail` records of one round carry findings on the same file and symbol with different summaries
- **THEN** the second close returns `next.action: narrow`

### Requirement: Scope narrowing

The kernel SHALL assign each attempt of a round a scope that never widens, and SHALL surface the findings a narrower scope drops.

Attempt 1 runs `full`, attempt 2 `high+` (blockers and findings of severity `critical` or `high`), attempt 3 and later `blockers` (blockers and `critical` findings); the escalation ticket keeps the latest scope. At `attempt open`, the `proposed` findings of the previous `fail` record that fall outside the new scope are listed in the record's `dropped` and the output, and one kernel `finding` entry with `review: true` whose `refs` are the target and the dropped ids records them for the human.

#### Scenario: scope N+1 is a subset of scope N

- **WHEN** ticket 1 of `task-redispatch 02-3` closed `fail` with one `high` and one `low` finding, and `attempt open task-redispatch 02-3` runs
- **THEN** the output has `scope: high+`, `narrowedFrom: full` and `dropped` naming only the `low` finding, and the ledger holds a new kernel `finding` with `review: true` referencing it

### Requirement: Diff check

The kernel SHALL compare the real working-tree diff with the plan at `attempt close` and `commit`, never with the envelope's file list (P6).

The touched paths are the changes of the target's work root (`kernel-state`, Part worktree): the part's worktree for a task or part of a live worktree part, the home checkout otherwise. Inside a worktree no other part runs, so the work-in-flight rule below never applies there, and the home checkout's diff never holds a worktree part's paths. During a merge ticket (`kernel-cli/attempt`, bdk attempt open) a path whose content equals its version on the merged Change branch came in with the merge and is not the agent's work, so it is left out of the touched paths; the record's `conflicts` count as declared paths of the ticket. The touched paths are that working tree's changes, untracked files included; a path whose whole change is staged is the user's (main-thread git, T3) and left out, so neither check nor commit sweeps it in; `.bdk/` is excluded, and `.gitignore` excluded while it differs from `HEAD` only by the lines of `kernel-state`, Ignored paths (the kernel's own edit at `change new`). For a task target the declared paths are the task's `Files:` and the forbidden globs the part's `do-not-touch`; for a part target the union of its tasks' `Files:` and its `do-not-touch`; for the Change target (a `review-fix` ticket) every touched path as declared and the `do-not-touch` of every started part, so nothing is reported undeclared, because a review fix may touch any path the review names (T42); a `verifier` target is not checked. A touched path that the target does not declare and another task of a started part without a trailer commit does declare is that task's work in flight: parts run in parallel in one working tree, so it is neither checked against the forbidden globs nor reported, and `commit` leaves it to its task. Any other touched path matching a forbidden glob refuses with `policy/do-not-touch` naming the path and the glob. A touched path that is not declared by the target and not declared by another task of a started part without a trailer commit is undeclared: it is reported in `diff.undeclared` and recorded as one kernel `finding` naming the paths.

#### Scenario: do-not-touch at attempt close

- **WHEN** part `02` declares `do-not-touch: [src/billing/**]`, ticket `A-xxxxxxxx` of `task-redispatch 02-3` is open and the working tree changes `src/billing/invoice.ts`
- **THEN** `attempt close A-xxxxxxxx ok` exits 2 with `rule: policy/do-not-touch` naming `src/billing/invoice.ts` and `src/billing/**`, and the record stays open

#### Scenario: undeclared file

- **WHEN** task `02-3` declares `src/auth/login.ts` and the working tree also changes `src/auth/util.ts`, which no other task declares
- **THEN** `attempt close` exits 0 with `diff.undeclared: [src/auth/util.ts]` and a kernel `finding` naming the path

#### Scenario: sibling task's file

- **WHEN** tasks `02-3` and `02-4` run in one wave and the working tree changes a file only `02-4` declares
- **THEN** the diff check of `02-3` does not report it as undeclared

#### Scenario: worktree part checked in its worktree

- **WHEN** part `02` is a live worktree part, task `02-1` declares `src/api/http.ts`, the worktree changes `src/api/http.ts` and `pnpm-lock.yaml`, and the home checkout changes `src/ui/format.ts` of task `01-1`
- **THEN** `bdk commit 02-1` commits `src/api/http.ts` and `pnpm-lock.yaml` on the part branch, records `pnpm-lock.yaml` as undeclared in one kernel `finding`, and leaves the home checkout unchanged

#### Scenario: merged-in paths are not the agent's

- **WHEN** a merge ticket of worktree part `02` resolves `pnpm-lock.yaml`, and the merge brought in `src/ui/format.ts` of part `01`, which matches part `02`'s `do-not-touch: [src/ui/**]`
- **THEN** `attempt close <ticket> ok` does not refuse with `policy/do-not-touch`, reports no undeclared path for `src/ui/format.ts`, and counts `pnpm-lock.yaml` as declared

#### Scenario: another part's work in flight

- **WHEN** parts `01` and `02` are started, part `01` declares `do-not-touch: [src/api/**]`, task `02-1` declares `src/api/http.ts` and has no trailer commit, and the working tree changes `src/ui/format.ts` of task `01-1` and `src/api/http.ts`
- **THEN** `commit 01-1` exits 0 and commits `src/ui/format.ts` only, and `src/api/http.ts` stays in the working tree for `02-1`

#### Scenario: review fix touches a file no task declares

- **WHEN** a `review-fix` ticket of the Change is open and the working tree changes `src/util.ts`, which no task declares and no `do-not-touch` matches
- **THEN** `attempt close` and `commit <change-id>` report no `diff.undeclared` and write no kernel `finding`

### Requirement: Progress from git

The kernel SHALL derive task progress from commit trailers and attempt state from committed attempt records, so that a killed session loses at most the uncommitted records (V1-4, S5).

A task is committed when a commit reachable from `HEAD` of its work root (`kernel-state`, Part worktree) carries `BDK-Change: <change id>`, `BDK-Part: <part id>` and `BDK-Task: <task id>`; for a task of a live worktree part that is the part branch, for every other task the home checkout's `HEAD`, which reaches a merged part's commits through its part merge commit. A part merge commit has two parents and carries `BDK-Change` and `BDK-Part` without `BDK-Task` (`kernel-cli/part`, bdk part done). A commit carrying `BDK-Change` and `BDK-Ticket` of a `review-fix` ticket of the Change is a review fix (`kernel-cli/commit`, bdk commit) and commits no task. Trailers and records disagree (`state/trailer-mismatch`, naming both sides) when a `BDK-Task` names a task no part holds, when `BDK-Part` differs from the part holding the task, when a commit carries `BDK-Change` of the Change without the other two trailers, is not a part merge commit and carries no `BDK-Ticket` naming a `review-fix` ticket of the Change, when a part merge commit's `BDK-Part` names no part, or when an attempt record's task target is held by no part.

#### Scenario: killed session and rebuild

- **WHEN** a session committed task `02-1`, closed two attempts of `02-2` and checkpointed, then died with ticket `A-xxxxxxxx` open; the repository is cloned afresh and `bdk change resume <id>` and `bdk rebuild` run
- **THEN** `part list` shows part `02` with `done: 1`, `attempt list --for 02-2` shows the two closed records with their outcomes, the open ticket and the same budgets as before

#### Scenario: trailer names a missing task

- **WHEN** a commit carries `BDK-Task: 02-9` and no part holds `02-9`
- **THEN** `bdk rebuild` exits 4 with `rule: state/trailer-mismatch` naming the commit and the plan

#### Scenario: review fix commit agrees with the records

- **WHEN** the Change has a commit with trailers `BDK-Change` and `BDK-Ticket` naming its closed `review-fix` ticket, and `bdk rebuild` runs
- **THEN** no `state/trailer-mismatch` is raised and no task counts as committed by that commit

#### Scenario: merged worktree part

- **WHEN** worktree part `02` committed `02-1` and `02-2` on its branch and `bdk part done 02` merged it
- **THEN** `bdk rebuild` exits 0, `part list` shows part `02` with `done: 2`, and the merge commit is not reported as a mismatch

#### Scenario: progress inside a live worktree

- **WHEN** worktree part `02` is live and task `02-1` has a trailer commit on `bdk-part/<id>/02` only
- **THEN** `part list` shows part `02` with `done: 1`

### Requirement: Checkpoint

The kernel SHALL commit only the Change directory in a checkpoint, as `chore(bdk): checkpoint <change id>`, and SHALL skip it when it could sweep in or race with other work.

The checkpoint stages the Change directory and commits it with a pathspec commit, so files the user staged elsewhere stay staged and uncommitted. It is skipped when `policy.checkpoint.enabled` is false, when nothing under the Change directory changed, while a rebase, merge or cherry-pick is in progress, while a ticket is open and when a git hook fails. `change checkpoint` reports the first two as `skipped` and refuses the last three; `change park`, `attempt open --escalate` and the end of the ladder run it and report a skip without failing.

#### Scenario: user's staged files stay out

- **WHEN** the user staged `src/app.ts` and a ledger entry was written, and `bdk change checkpoint` runs
- **THEN** the new commit contains only paths under `.bdk/changes/<id>/`, its subject is `chore(bdk): checkpoint <id>`, and `src/app.ts` is still staged

#### Scenario: disabled by policy

- **WHEN** `policy.checkpoint.enabled` is false and `bdk change checkpoint --json` runs
- **THEN** the exit code is 0, `done` is false, `skipped` names the key and no commit is created

### Requirement: Plan part checks

The `plan-part` kind SHALL check each part with the S1, P6 and P7 rules below, through `validate`, `done` and `part start`.

| Check          | Fails when                                                                                                                                                                                                  | Rule of `validate` and `part start` |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `size`         | the part file is over 8 192 bytes                                                                                                                                                                           | `policy/part-too-large`             |
| `tasks`        | the part holds no task or more than 8                                                                                                                                                                       | `policy/part-too-many-tasks`        |
| `do-not-touch` | a task's `Files:` path matches a `do-not-touch` glob                                                                                                                                                        | `policy/do-not-touch-overlap`       |
| `placeholder`  | an executable field holds a placeholder (`kernel-state`, Plan part and plan index)                                                                                                                          | `policy/placeholder`                |
| `grammar`      | a task lacks `Files:`, lacks both `Test cases:` and `Verification: none`, repeats an id, or names an unknown task in `Depends on:`                                                                          | `policy/validation-failed`          |
| `spec-impact`  | `spec-impact` is absent in a `large` Change, or names a capability whose `spec-delta/<capability>.md` is missing or fails `spec delta check` (`kernel-cli/spec`); absent means `none` in `tiny` and `small` | `policy/validation-failed`          |
| `isolation`    | `isolation` is `worktree` and `isolation-reason` is absent or empty                                                                                                                                         | `policy/validation-failed`          |

`done` answers any failing check with `policy/validation-failed` naming the checks; `validate` lists every check.

#### Scenario: nine kilobyte part

- **WHEN** `plan/parts/02-login.md` is 9 216 bytes and `bdk part start 02` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/part-too-large` with `why` naming the size and 8 192, and no entry is written

#### Scenario: placeholder in a test case

- **WHEN** a task's `Test cases:` list holds the item `TODO`
- **THEN** `bdk validate plan-part:02 --json` reports check `placeholder` failed naming the task

#### Scenario: invalid delta fails the part

- **WHEN** part `02` declares `spec-impact: [auth/login]` and `spec-delta/auth/login.md` has a scenario without `- **THEN**`, and `bdk validate plan-part:02 --json` runs
- **THEN** check `spec-impact` fails and its `why` names `then-missing` and the delta's path and line

#### Scenario: spec-impact default by profile

- **WHEN** part `01` has no `spec-impact` field
- **THEN** check `spec-impact` passes in a `small` Change and fails in a `large` Change with `why` asking to declare `spec-impact`

#### Scenario: worktree without a reason

- **WHEN** part `02` sets `isolation: worktree` and no `isolation-reason`
- **THEN** `bdk validate plan-part:02 --json` reports check `isolation` failed, and `bdk part start 02` exits 2 with `rule: policy/validation-failed` naming `isolation`

### Requirement: Tiny guard

`commit` and `part done` of a Change whose effective profile is `tiny` SHALL measure the Change's commits and SHALL record a `finding` with `review: true` when they exceed 2 files, 1 module or 50 lines, without refusing (T20 design D-11).

The range runs from the parent of the Change's first commit carrying its `BDK-Change` trailer to `HEAD`, measured like `bdk measure`.

#### Scenario: tiny Change grows

- **WHEN** a `tiny` Change's commits change 3 files and `bdk commit 01-2` runs
- **THEN** the commit is created, exit code 0, and the ledger holds one kernel `finding` with `review: true` naming 3 files; a second commit with the same numbers adds no entry
