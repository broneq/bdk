## MODIFIED Requirements

### Requirement: Diff check

The kernel SHALL compare the real working-tree diff with the plan at `attempt close` and `commit`, never with the envelope's file list (P6).

The touched paths are the changes of the target's work root (`kernel-state`, Part worktree): the part's worktree for a task or part of a live worktree part, the home checkout otherwise. Inside a worktree no other part runs, so the work-in-flight rule below never applies there, and the home checkout's diff never holds a worktree part's paths. During a merge ticket (`kernel-cli/attempt`, bdk attempt open) a path whose content equals its version on the merged Change branch came in with the merge and is not the agent's work, so it is left out of the touched paths; the record's `conflicts` count as declared paths of the ticket. The touched paths are that working tree's changes, untracked files included; a path whose whole change is staged is the user's (main-thread git, T3) and left out, so neither check nor commit sweeps it in; `.bdk/` is excluded, and `.gitignore` excluded while it differs from `HEAD` only by the lines of `kernel-state`, Ignored paths (the kernel's own edit at `change new`). For a task target the declared paths are the task's `Files:` and the forbidden globs the part's `do-not-touch`; for a part target the union of its tasks' `Files:` and its `do-not-touch`; for the Change target (a `review-fix` ticket) every touched path as declared and no forbidden glob, so nothing is reported undeclared and nothing is refused, because a review fix may touch any path the review names (T42) and a part's `do-not-touch` binds the tasks of that part only; a `verifier` target is not checked. A touched path that the target does not declare and another task of a started part without a trailer commit does declare is that task's work in flight: parts run in parallel in one working tree, so it is neither checked against the forbidden globs nor reported, and `commit` leaves it to its task. Any other touched path matching a forbidden glob refuses with `policy/do-not-touch` naming the path and the glob. A touched path that is not declared by the target and not declared by another task of a started part without a trailer commit is undeclared: it is reported in `diff.undeclared` and recorded as one kernel `finding` naming the paths.

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

#### Scenario: review fix touches a do-not-touch path

- **WHEN** parts `01` and `02` are done, part `01` declares `do-not-touch: [src/billing/**]`, a `review-fix` ticket of the Change is open and the working tree changes `src/billing/invoice.ts`
- **THEN** `commit <change-id>` exits 0 and commits `src/billing/invoice.ts` under the ticket, and `attempt close` of the ticket does not refuse with `policy/do-not-touch`
