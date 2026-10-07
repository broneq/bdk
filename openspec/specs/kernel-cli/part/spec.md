# kernel-cli/part Specification

## Purpose

Plan parts (`part`). Parts of a plan (S1): read with `list`, opened with `start`, closed with `done`, divided with `split`. State is derived from trailers and attempt records, never stored in the plan file.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/part-too-large",
  "why": "plan/parts/02-login.md is 9 412 bytes; the limit is 8 192",
  "instead": [
    "bdk part split 02 02-3,02-4",
    "shorten the part and run bdk validate plan-part:02"
  ]
}
```

## Requirements

### Requirement: bdk part list

Plan parts with state, task counts, size, dependencies and wave. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part list`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** State is derived, never read from a mutable field in the plan (progress lives in git): the `execute-part:<nn>` node state (`kernel-pipeline`, Node states), shown as `started` when the node is `ready` and a `part start` marker is later than its latest done marker, and as `stale` when a done part's file changed afterwards. `tasks` counts the part's tasks, `done` the tasks with a trailer commit (`kernel-loops`, Progress from git), `bytes` the part file's size (an oversized part is listed, not hidden), `wave` comes from the plan index rule (`kernel-state`, Plan part and plan index) and `specImpact` is `none` or `delta`. Parts in id order; a Change without plan parts answers an empty list.
- **Writes:** nothing
- **Output:** `schema/cli/output/part-list.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk part list --json
  ```

  ```json
  {
    "items": [
      {
        "part": "01",
        "title": "Token service",
        "state": "done",
        "tasks": 4,
        "done": 4,
        "bytes": 5120,
        "specImpact": "delta",
        "wave": 1
      },
      {
        "part": "02",
        "title": "Login endpoint",
        "state": "started",
        "tasks": 3,
        "done": 1,
        "bytes": 4210,
        "dependsOn": [
          "01"
        ],
        "specImpact": "none",
        "wave": 2
      }
    ],
    "total": 2,
    "truncated": false
  }
  ```

- **Owner:** T22
- **Slice:** `part`

#### Scenario: example run

- **WHEN** `bdk part list --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/part-list.json`

#### Scenario: oversized part is listed

- **WHEN** `plan/parts/03-mail.md` is 9 216 bytes
- **THEN** `part list --json` lists part `03` with `bytes: 9216` and exits 0

### Requirement: bdk part start

Validate a part and record the start transition; required before its first ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part start <part>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
- **Behaviour:** Runs the part checks of `kernel-loops`, Plan part checks, first and refuses with the rule of the first failing check, so a part edited after `plan` names its own fault rather than the stale plan. Then refuses with `policy/not-ready` while the `execute-part:<nn>` node is `blocked` (a `depends-on` part not done, or the plan or plan verification not done), naming the first unfinished requirement. A part that is already started and not done, or done, is `policy/invalid-transition`. Then refuses with `policy/tools-unset` when a node of the Change's graph that is not `skipped` belongs to an unset tool group (`kernel-pipeline`, Tool group nodes), naming the group and the nodes, with the `instead` of `change new` (`kernel-cli/change`, bdk change new); a setting removed after the Change opened is caught here, before a task runs. On success writes a `transition` entry with `to: execute-part:<nn>`, `source: kernel`, `refs` naming the part file, and no `input-hash` (the start marker: it moves the stage to `execute` and never marks the node done). The output lists the tasks with their `Files:` and the part's `do-not-touch` and `success-measure`, which the orchestrator passes on without reading the plan file, and `isolation`.

  A part with `isolation: worktree`, while `execution.worktree.enabled` is true, then gets its worktree before the start marker is written (`kernel-state`, Part worktree): the kernel checks that git supports `git merge-tree --write-tree` (git 2.38 or later, `runtime/git-too-old` otherwise) and that `execution.worktree.dir` is ignored when it lies inside the repository (`policy/config-invalid`), runs `git worktree add -b bdk-part/<change id>/<part> <dir>/<change id>/<part> HEAD` in the home checkout, writes the home marker, copies each file that `.worktreeinclude` matches and git ignores, keeping its relative path, and runs `execution.worktree.setup.command` in the worktree with `execution.worktree.setup.timeout`. A setup that exits non-zero or times out refuses with `runtime/worktree-setup-failed`, whose `why` names the command, the exit code or the timeout and the last 20 lines of its output, and whose `instead` is to fix the setup and run `part start` again, or to set `execution.worktree.enabled: false`; the worktree and its branch are removed and no entry is written. A worktree or branch left at that path by a killed `part start` is removed first. On success the start marker's body records `workdir`, from which every command resolves the part's work root (`kernel-state`, Part worktree), and the setup (command, exit code, duration in ms, and the last 20 lines of output), and the output carries `workdir`, the worktree's absolute path, and `setup`, `{command, exitCode, durationMs}` or absent without a setup command. With `enabled: false` the part starts in the home checkout, as a `shared` part does, and the output says `isolation: shared` and `downgraded: true`.

- **Writes:** `.bdk/changes/<id>/log/`, `git:worktree`
- **Output:** `schema/cli/output/part-start.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/invalid-transition`, `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/part-too-many-files`, `policy/do-not-touch-overlap`, `policy/placeholder`, `policy/validation-failed`, `policy/config-invalid`, `policy/tools-unset`, `runtime/worktree-setup-failed`, `runtime/git-too-old`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk part start 02 --json
  ```

  ```json
  {
    "part": "02",
    "state": "started",
    "tasks": [
      {
        "task": "02-1",
        "files": [
          "src/auth/login.ts"
        ]
      },
      {
        "task": "02-2",
        "files": [
          "src/auth/login.test.ts"
        ]
      }
    ],
    "doNotTouch": [
      "src/billing/**"
    ],
    "successMeasure": "POST /login returns a session for a valid magic link",
    "entry": "L-r2v8k4mn",
    "isolation": "shared"
  }
  ```

- **Owner:** T22
- **Slice:** `part`

#### Scenario: example run

- **WHEN** `bdk part start 02 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/part-start.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/not-ready

- **WHEN** the artifact, part or task is blocked by an unfinished `requires` edge
- **THEN** the exit code is 2 and the error object carries `rule: policy/not-ready`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/part-too-large

- **WHEN** a plan part is over 8 KB (S1, P6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/part-too-large`

#### Scenario: policy/part-too-many-tasks

- **WHEN** a plan part has more tasks than `plan.part.max-tasks` (S1, #166)
- **THEN** the exit code is 2 and the error object carries `rule: policy/part-too-many-tasks`

#### Scenario: policy/part-too-many-files

- **WHEN** the tasks of a plan part declare more distinct `Files:` paths than `plan.part.max-files` (#166)
- **THEN** the exit code is 2 and the error object carries `rule: policy/part-too-many-files`, and `instead` names `bdk part split`

#### Scenario: policy/do-not-touch-overlap

- **WHEN** a task's `Files:` intersects the part's `do-not-touch` (P6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/do-not-touch-overlap`

#### Scenario: policy/placeholder

- **WHEN** an executable field contains `TODO`, `<fill in>` or `...` (P6, P7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/placeholder`

#### Scenario: policy/validation-failed

- **WHEN** a task has neither `Test cases:` nor `Verification: none`
- **THEN** the exit code is 2 and the error object carries `rule: policy/validation-failed` naming the check `grammar` and the task

#### Scenario: worktree part starts in its worktree

- **WHEN** part `02` sets `isolation: worktree`, `.worktreeinclude` lists `.env`, `.env` is ignored and present in the home checkout, `execution.worktree.setup.command` is `pnpm install --frozen-lockfile`, and `bdk part start 02 --json` runs
- **THEN** the exit code is 0, `workdir` is `<project root>/.bdk/.machine/worktrees/<change id>/02`, that directory holds `.env` and `node_modules/`, `setup.exitCode` is 0, and the start marker's body names the command and its duration

#### Scenario: runtime/worktree-setup-failed

- **WHEN** the setup command of a `worktree` part exits 1
- **THEN** the exit code is 5, the error object carries `rule: runtime/worktree-setup-failed` naming the command and its output tail, `git worktree list` holds no worktree of the part, the branch `bdk-part/<change id>/02` does not exist, and no start marker is written

#### Scenario: worktrees disabled

- **WHEN** `.bdk/settings.yaml` sets `execution.worktree.enabled: false` and `bdk part start 02 --json` runs for a `worktree` part
- **THEN** the exit code is 0, the output has `isolation: shared`, `downgraded: true` and no `workdir`, and no worktree is created

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: policy/config-invalid

- **WHEN** `execution.worktree.dir` is `worktrees`, no ignore rule covers `worktrees/`, and `bdk part start 02` runs for a `worktree` part
- **THEN** the exit code is 2, the error object carries `rule: policy/config-invalid` naming `execution.worktree.dir`, and no worktree exists

#### Scenario: policy/tools-unset

- **WHEN** the Change opened with `tools.lint: none`, the project then removed `tools.lint`, and `bdk part start 01` runs on a ready part
- **THEN** the exit code is 2, the error object carries `rule: policy/tools-unset` naming `tools.lint`, and no entry is written

#### Scenario: runtime/git-too-old

- **WHEN** the git on `PATH` is 2.37 and `bdk part start 02` runs for a `worktree` part
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-too-old` naming 2.38

#### Scenario: start marker does not finish the node

- **WHEN** `bdk part start 02` succeeded
- **THEN** `bdk explain execute-part:02` shows the node `ready`, not `done` or `stale`, `part list` shows `state: started`, and the Change's stage is `execute`

### Requirement: bdk part done

Close a part: every task has a trailer commit and no ticket is open. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part done <part>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
- **Behaviour:** Runs the `execute-part` kind's checks (`kernel-pipeline`, Artifact kinds): the part is started, each of its tasks has a commit reachable from `HEAD` carrying `BDK-Change`, `BDK-Part: <part>` and `BDK-Task: <task>` (the read-back after write that TSH confirmed), and no ticket of the part or its tasks is open. A part that is not started, or already done with an unchanged file, is `policy/invalid-transition`; an open ticket is `policy/ticket-open`; a task without a trailer commit is `policy/validation-failed` naming the task; trailers that disagree with the plan are `state/trailer-mismatch` (`kernel-loops`, Progress from git). On success writes a `transition` entry with `to: execute-part:<nn>`, `source: kernel` and the `input-hash` of the part file, then runs a checkpoint of the Change directory (`kernel-loops`, Checkpoint), which reports a skip without failing and returns its commit as `checkpoint`: the part's agents commit their code with plain git (#166), so the attempt records, reports, evidence and entries of the part reach git here, once per part; while a ticket of another part is open the checkpoint skips and the last `part done` of the wave catches up. Open `finding` entries referencing the part or its tasks do not block; they are listed in `openFindings`. For a `tiny` Change the tiny guard runs (`kernel-loops`, Tiny guard). `next` is the id of the node `bdk next` returns afterwards, absent when none.

  For a live worktree part, the trailer commits are read from the part branch, and the checks above are followed by the merge back (user decision 2026-10-04: a merge commit, never a rebase), all under the commit lock (`kernel-cli/commit`, Serialised commits):

  1. A path of the part's `Files:` that the worktree still changes refuses with `policy/worktree-dirty` naming the paths; any other changed path of the worktree is a leftover (generated output, a regenerated lockfile nobody committed), listed in `discarded` and recorded as one kernel `finding` naming the paths.
  2. `git merge-tree --write-tree <home HEAD> bdk-part/<change id>/<part>` computes the merge without touching any working tree. A conflict refuses with `policy/merge-conflict`, whose `why` names the conflicting paths and whose `instead` is `bdk attempt open verify-fix <part>`, the merge ticket that resolves it inside the worktree under the project's merge instruction (`kernel-cli/attempt`, bdk attempt open; user decision 2026-10-04); nothing is written. An agent resolves it only inside that ticket, with its budget, its post-task steps and the ladder, which parks the Change for the user when the round is used up.
  3. `git commit-tree` writes the merge commit of that tree with the parents home `HEAD` and the part branch tip, the subject `chore(bdk): merge part <part> of <change id>` and the trailers `BDK-Change` and `BDK-Part`; the part's commits keep their SHAs and trailers.
  4. `git merge --ff-only <merge commit>` in the home checkout moves the Change branch. A home path the merge would overwrite that is changed in the home working tree refuses with `policy/merge-blocked` naming the paths, with `instead` to run `part done` again once the task that changes them is committed; the merge commit is left unreferenced and nothing is written.
  5. The kernel removes the worktree (`git worktree remove --force`, after step 1 recorded the leftovers) and deletes the part branch, then writes the done marker and the entry and runs the checkpoint above.

  The output then carries `merge`, the merge commit's short SHA, and `discarded`. A `shared` part, and a part started while worktrees were disabled, is done exactly as before, with no merge.

- **Writes:** `.bdk/changes/<id>/log/`, `git:commit`, `git:worktree`
- **Output:** `schema/cli/output/part-done.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`, `policy/ticket-open`, `policy/validation-failed`, `policy/worktree-dirty`, `policy/merge-conflict`, `policy/merge-blocked`, `policy/commit-busy`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk part done 02 --json
  ```

  ```json
  {
    "part": "02",
    "state": "done",
    "commits": [
      {
        "task": "02-1",
        "commit": "b4d2e1f"
      },
      {
        "task": "02-2",
        "commit": "c7a9d30"
      }
    ],
    "openFindings": [],
    "entry": "L-y5u3e7wq",
    "checkpoint": "e1f2a3b",
    "next": "execute-part:03"
  }
  ```

- **Owner:** T22
- **Slice:** `part`

#### Scenario: example run

- **WHEN** `bdk part done 02 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/part-done.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: policy/validation-failed

- **WHEN** task `02-2` has no commit carrying `BDK-Task: 02-2`
- **THEN** the exit code is 2 and the error object carries `rule: policy/validation-failed` naming `02-2`

#### Scenario: state/trailer-mismatch

- **WHEN** progress derived from git trailers disagrees with the committed attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: worktree part merges back

- **WHEN** worktree part `02` committed `02-1` and `02-2` on its branch, shared part `01` committed `01-1` in the home checkout meanwhile, and `bdk part done 02 --json` runs
- **THEN** the exit code is 0, home `HEAD` is a merge commit with the trailers `BDK-Change` and `BDK-Part: 02` whose second parent is the part branch's former tip, `git log` of home `HEAD` reaches the commits of `02-1` and `02-2` with their original SHAs and trailers and the commit of `01-1`, `git worktree list` holds no worktree of part 02, and the branch `bdk-part/<change id>/02` is gone

#### Scenario: policy/merge-conflict

- **WHEN** the part branch and home `HEAD` both changed `pnpm-lock.yaml` differently since the worktree was created
- **THEN** the exit code is 2, the error object carries `rule: policy/merge-conflict` naming `pnpm-lock.yaml` with `instead: [bdk attempt open verify-fix 02]`, home `HEAD` and the home working tree are unchanged, the worktree still exists, and no entry is written

#### Scenario: policy/merge-blocked

- **WHEN** the part branch changed `pnpm-lock.yaml`, home `HEAD` did not, and the home working tree holds an uncommitted change of `pnpm-lock.yaml` by shared task `01-2`
- **THEN** the exit code is 2, the error object carries `rule: policy/merge-blocked` naming `pnpm-lock.yaml`, home `HEAD` is unchanged, and the home working tree still holds the change of `01-2`

#### Scenario: leftovers recorded, then removed

- **WHEN** every task of worktree part `02` is committed and the worktree still holds an untracked `src/gen/schema.ts` that no task declares
- **THEN** `part done 02` exits 0 with `discarded: [src/gen/schema.ts]`, the ledger holds one kernel `finding` naming it, and the worktree is removed

#### Scenario: policy/worktree-dirty

- **WHEN** task `02-1` declares `src/api/http.ts`, is committed, and the worktree changes `src/api/http.ts` again
- **THEN** the exit code is 2 and the error object carries `rule: policy/worktree-dirty` naming `src/api/http.ts`

#### Scenario: policy/commit-busy

- **WHEN** another process holds `.bdk/.machine/commit.lock` past the wait while `bdk part done 02` merges a worktree part back
- **THEN** the exit code is 2, the error object carries `rule: policy/commit-busy`, and home `HEAD` is unchanged

#### Scenario: done marks the node

- **WHEN** `bdk part done 02` succeeded
- **THEN** `execute-part:02` is `done`, and after an edit of `plan/parts/02-login.md` it is `stale`

#### Scenario: part done checkpoints the Change

- **WHEN** every task of shared part `02` is committed by its agent with plain git, the `part 02` ticket is closed, no other ticket is open, and `bdk part done 02 --json` runs
- **THEN** the exit code is 0, `HEAD` is a commit `chore(bdk): checkpoint <change id>` holding the part's attempt records and reports, and the output's `checkpoint` names it

#### Scenario: checkpoint skipped while another part runs

- **WHEN** a ticket of part `03` is open and `bdk part done 02` runs
- **THEN** the exit code is 0, no checkpoint commit is created and the output has no `checkpoint`

### Requirement: bdk part split

Split an oversized or parked part into two parts with the same dependencies. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part split <part> <task-ids>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
  - `<task-ids>` (required). Comma-separated tasks that move to the new part.
- **Behaviour:** The one command that edits plan files after `plan` is done. The new part's id is the highest part id plus one; its file `plan/parts/<nn>-<slug>.md` carries the moved tasks with their ids unchanged (their attempt records and budgets carry over) and a copy of the original's frontmatter with `id` set and ` (split from <part>)` appended to `title`. The original part is rewritten without the moved tasks, the new id is added to the `depends-on` of every part that depended on the original, `plan/index.md` is regenerated, and a `decision` entry (`source: kernel`) names both parts and the moved tasks. The changed part files change their hashes, so the `plan-part` instances and `plan-verify` turn `stale` and the plan verifier runs again. Refuses with `policy/invalid-transition` for a done part and for a task that already has a trailer commit; with `input/invalid-argument` when every task of the part would move or a task id is not in the part; with `policy/ticket-open` while a ticket of the part or a moved task is open. Used as the `split part` option of a parked Change.
- **Writes:** `.bdk/changes/<id>/plan/parts/`, `.bdk/changes/<id>/plan/index.md`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/part-split.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`, `policy/ticket-open`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk part split 02 02-3,02-4 --json
  ```

  ```json
  {
    "part": "02",
    "newPart": "05",
    "moved": [
      "02-3",
      "02-4"
    ],
    "entry": "L-n1b7c5xz"
  }
  ```

- **Owner:** T22
- **Slice:** `part`

#### Scenario: example run

- **WHEN** `bdk part split 02 02-3,02-4 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/part-split.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: split keeps history and re-verifies

- **WHEN** task `02-3` has two failed attempt records and `bdk part split 02 02-3` runs
- **THEN** `plan/parts/05-<slug>.md` holds task `02-3`, `attempt list --for 02-3` still shows two records with the same budget, and `plan-verify` is `stale`
