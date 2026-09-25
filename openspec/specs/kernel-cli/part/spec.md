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
- **Behaviour:** State is derived from trailers and attempt records, never from a mutable field in the plan (progress lives in git).
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

### Requirement: bdk part start

Validate a part and record the start transition; required before its first ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part start <part>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
- **Behaviour:** Refuses a part whose `Depends on` parts are not done, and runs the part validators: <= 8 KB, <= 8 tasks, `goal`, `success-measure` and `do-not-touch` present, no task `Files:` inside `do-not-touch`, no placeholders in executable fields (P6, P7, S1).
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/part-start.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/invalid-transition`, `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/do-not-touch-overlap`, `policy/placeholder`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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
    "entry": "L-r2v8k"
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

### Requirement: bdk part done

Close a part: every task has a trailer commit and no ticket is open. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part done <part>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
- **Behaviour:** The validator reads git: each task of the part must have a commit carrying `BDK-Task: <task>` (the read-back after write that TSH confirmed). Open `finding` entries do not block; they are listed.
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
    "entry": "L-y5u3e",
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

- **WHEN** a kind validator failed
- **THEN** the exit code is 2 and the error object carries `rule: policy/validation-failed`

#### Scenario: state/trailer-mismatch

- **WHEN** progress derived from git trailers disagrees with the committed attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

### Requirement: bdk part split

Split an oversized or parked part into two parts with the same dependencies. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk part split <part> <task-ids>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<part>` (required).
  - `<task-ids>` (required). Comma-separated tasks that move to the new part.
- **Behaviour:** The one command that edits plan files after `plan` is done: it appends a new part file, updates `plan/index.md` and marks the affected plan nodes `stale`, so the plan verifier runs again on both parts. Used as the `split part` option of a parked Change.
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
    "entry": "L-n1b7c"
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
