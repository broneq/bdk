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

The touched paths are the working tree's changes, untracked files included; a path whose whole change is staged is the user's (main-thread git, T3) and left out, so neither check nor commit sweeps it in; `.bdk/` is excluded, and `.gitignore` excluded while it differs from `HEAD` only by the lines of `kernel-state`, Ignored paths (the kernel's own edit at `change new`). For a task target the declared paths are the task's `Files:` and the forbidden globs the part's `do-not-touch`; for a part target the union of its tasks' `Files:` and its `do-not-touch`; for the Change target no declared paths and the `do-not-touch` of every started part; a `verifier` target is not checked. A touched path matching a forbidden glob refuses with `policy/do-not-touch` naming the path and the glob. A touched path that is not declared by the target and not declared by another task of a started part without a trailer commit is undeclared: it is reported in `diff.undeclared` and recorded as one kernel `finding` naming the paths.

#### Scenario: do-not-touch at attempt close

- **WHEN** part `02` declares `do-not-touch: [src/billing/**]`, ticket `A-xxxxxxxx` of `task-redispatch 02-3` is open and the working tree changes `src/billing/invoice.ts`
- **THEN** `attempt close A-xxxxxxxx ok` exits 2 with `rule: policy/do-not-touch` naming `src/billing/invoice.ts` and `src/billing/**`, and the record stays open

#### Scenario: undeclared file

- **WHEN** task `02-3` declares `src/auth/login.ts` and the working tree also changes `src/auth/util.ts`, which no other task declares
- **THEN** `attempt close` exits 0 with `diff.undeclared: [src/auth/util.ts]` and a kernel `finding` naming the path

#### Scenario: sibling task's file

- **WHEN** tasks `02-3` and `02-4` run in one wave and the working tree changes a file only `02-4` declares
- **THEN** the diff check of `02-3` does not report it as undeclared

### Requirement: Progress from git

The kernel SHALL derive task progress from commit trailers and attempt state from committed attempt records, so that a killed session loses at most the uncommitted records (V1-4, S5).

A task is committed when a commit reachable from `HEAD` carries `BDK-Change: <change id>`, `BDK-Part: <part id>` and `BDK-Task: <task id>`. Trailers and records disagree (`state/trailer-mismatch`, naming both sides) when a `BDK-Task` names a task no part holds, when `BDK-Part` differs from the part holding the task, when a commit carries `BDK-Change` of the Change without the other two trailers, or when an attempt record's task target is held by no part.

#### Scenario: killed session and rebuild

- **WHEN** a session committed task `02-1`, closed two attempts of `02-2` and checkpointed, then died with ticket `A-xxxxxxxx` open; the repository is cloned afresh and `bdk change resume <id>` and `bdk rebuild` run
- **THEN** `part list` shows part `02` with `done: 1`, `attempt list --for 02-2` shows the two closed records with their outcomes, the open ticket and the same budgets as before

#### Scenario: trailer names a missing task

- **WHEN** a commit carries `BDK-Task: 02-9` and no part holds `02-9`
- **THEN** `bdk rebuild` exits 4 with `rule: state/trailer-mismatch` naming the commit and the plan

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

| Check          | Fails when                                                                                                                         | Rule of `validate` and `part start` |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `size`         | the part file is over 8 192 bytes                                                                                                  | `policy/part-too-large`             |
| `tasks`        | the part holds no task or more than 8                                                                                              | `policy/part-too-many-tasks`        |
| `do-not-touch` | a task's `Files:` path matches a `do-not-touch` glob                                                                               | `policy/do-not-touch-overlap`       |
| `placeholder`  | an executable field holds a placeholder (`kernel-state`, Plan part and plan index)                                                 | `policy/placeholder`                |
| `grammar`      | a task lacks `Files:`, lacks both `Test cases:` and `Verification: none`, repeats an id, or names an unknown task in `Depends on:` | `policy/validation-failed`          |
| `spec-impact`  | `spec-impact` names a capability without `spec-delta/<capability>.md`                                                              | `policy/validation-failed`          |

`done` answers any failing check with `policy/validation-failed` naming the checks; `validate` lists every check.

#### Scenario: nine kilobyte part

- **WHEN** `plan/parts/02-login.md` is 9 216 bytes and `bdk part start 02` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/part-too-large` with `why` naming the size and 8 192, and no entry is written

#### Scenario: placeholder in a test case

- **WHEN** a task's `Test cases:` list holds the item `TODO`
- **THEN** `bdk validate plan-part:02 --json` reports check `placeholder` failed naming the task

### Requirement: Tiny guard

`commit` and `part done` of a Change whose effective profile is `tiny` SHALL measure the Change's commits and SHALL record a `finding` with `review: true` when they exceed 2 files, 1 module or 50 lines, without refusing (T20 design D-11).

The range runs from the parent of the Change's first commit carrying its `BDK-Change` trailer to `HEAD`, measured like `bdk measure`.

#### Scenario: tiny Change grows

- **WHEN** a `tiny` Change's commits change 3 files and `bdk commit 01-2` runs
- **THEN** the commit is created, exit code 0, and the ledger holds one kernel `finding` with `review: true` naming 3 files; a second commit with the same numbers adds no entry
