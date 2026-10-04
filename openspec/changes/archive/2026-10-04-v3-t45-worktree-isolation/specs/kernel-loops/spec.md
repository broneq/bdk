## MODIFIED Requirements

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
