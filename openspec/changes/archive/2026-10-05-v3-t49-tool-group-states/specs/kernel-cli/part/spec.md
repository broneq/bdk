## MODIFIED Requirements

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
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/invalid-transition`, `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/do-not-touch-overlap`, `policy/placeholder`, `policy/validation-failed`, `policy/config-invalid`, `policy/tools-unset`, `runtime/worktree-setup-failed`, `runtime/git-too-old`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

- **WHEN** a plan part has more than 8 tasks (S1)
- **THEN** the exit code is 2 and the error object carries `rule: policy/part-too-many-tasks`

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
