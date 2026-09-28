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
- **Behaviour:** Runs the part checks of `kernel-loops`, Plan part checks, first and refuses with the rule of the first failing check, so a part edited after `plan` names its own fault rather than the stale plan. Then refuses with `policy/not-ready` while the `execute-part:<nn>` node is `blocked` (a `depends-on` part not done, or the plan or plan verification not done), naming the first unfinished requirement. A part that is already started and not done, or done, is `policy/invalid-transition`. On success writes a `transition` entry with `to: execute-part:<nn>`, `source: kernel`, `refs` naming the part file, and no `input-hash` (the start marker: it moves the stage to `execute` and never marks the node done). The output lists the tasks with their `Files:` and the part's `do-not-touch` and `success-measure`, which the orchestrator passes on without reading the plan file.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/part-start.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/invalid-transition`, `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/do-not-touch-overlap`, `policy/placeholder`, `policy/validation-failed`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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
    "entry": "L-r2v8k4mn"
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
- **Behaviour:** Runs the `execute-part` kind's checks (`kernel-pipeline`, Artifact kinds): the part is started, each of its tasks has a commit reachable from `HEAD` carrying `BDK-Change`, `BDK-Part: <part>` and `BDK-Task: <task>` (the read-back after write that TSH confirmed), and no ticket of the part or its tasks is open. A part that is not started, or already done with an unchanged file, is `policy/invalid-transition`; an open ticket is `policy/ticket-open`; a task without a trailer commit is `policy/validation-failed` naming the task; trailers that disagree with the plan are `state/trailer-mismatch` (`kernel-loops`, Progress from git). On success writes a `transition` entry with `to: execute-part:<nn>`, `source: kernel` and the `input-hash` of the part file. Open `finding` entries referencing the part or its tasks do not block; they are listed in `openFindings`. For a `tiny` Change the tiny guard runs (`kernel-loops`, Tiny guard). `next` is the id of the node `bdk next` returns afterwards, absent when none.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/part-done.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`, `policy/ticket-open`, `policy/validation-failed`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: done marks the node

- **WHEN** `bdk part done 02` succeeded
- **THEN** `execute-part:02` is `done`, and after an edit of `plan/parts/02-login.md` it is `stale`

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
