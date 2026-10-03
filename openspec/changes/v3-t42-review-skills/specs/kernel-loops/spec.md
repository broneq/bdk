## MODIFIED Requirements

### Requirement: Diff check

The kernel SHALL compare the real working-tree diff with the plan at `attempt close` and `commit`, never with the envelope's file list (P6).

The touched paths are the working tree's changes, untracked files included; a path whose whole change is staged is the user's (main-thread git, T3) and left out, so neither check nor commit sweeps it in; `.bdk/` is excluded, and `.gitignore` excluded while it differs from `HEAD` only by the lines of `kernel-state`, Ignored paths (the kernel's own edit at `change new`). For a task target the declared paths are the task's `Files:` and the forbidden globs the part's `do-not-touch`; for a part target the union of its tasks' `Files:` and its `do-not-touch`; for the Change target (a `review-fix` ticket) no declared paths, the `do-not-touch` of every started part and no undeclared report, because a review fix may touch any path the review names (T42); a `verifier` target is not checked. A touched path that the target does not declare and another task of a started part without a trailer commit does declare is that task's work in flight: parts run in parallel in one working tree, so it is neither checked against the forbidden globs nor reported, and `commit` leaves it to its task. Any other touched path matching a forbidden glob refuses with `policy/do-not-touch` naming the path and the glob. A touched path that is not declared by the target and not declared by another task of a started part without a trailer commit is undeclared: it is reported in `diff.undeclared` and recorded as one kernel `finding` naming the paths.

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
