# kernel-cli/graph Specification

## Purpose

Artifact graph (`graph`). The pipeline graph of T21: `next` is the entry point every stage skill injects, `explain` is its debugger, `validate` runs a kind validator without side effects, `done` is the only writer of an artifact's done state.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/not-ready",
  "why": "plan-verify requires plan-part:01, which is ready but not done",
  "instead": [
    "bdk explain plan-verify",
    "bdk done plan-part:01"
  ]
}
```

## Requirements

### Requirement: bdk next

The next ready artifact with its instruction, plus the gate status; the skill's entry point. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk next`
- **Availability:** `read`
- **Mode:** `inject`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Inject mode: called from stage skills' `!` blocks and by `hooks prompt-expansion`. Always exits 0; without a ready artifact it says what the Change waits for (a gate: render the gate status and stop; the user: a parked question). Never writes. When a gate is ready but not done, the Markdown output is the gate status the previous stage skill shows the user: the command to type and the pending `review: true` entries with ids and summaries.
- **Writes:** nothing
- **Output:** `schema/cli/output/next.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk next --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "stage": "plan",
    "artifact": {
      "id": "plan-part:01",
      "kind": "plan-part",
      "state": "ready",
      "requires": [
        "gate:design"
      ]
    },
    "instruction": "Write plan part 01 ...",
    "gates": [
      {
        "gate": "gate:design",
        "ready": true,
        "done": true,
        "passedBy": "user",
        "pending": []
      }
    ]
  }
  ```

- **Owner:** T21
- **Slice:** `graph`

#### Scenario: example run

- **WHEN** `bdk next --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/next.json`

### Requirement: bdk explain

Why an artifact is in its state: the `requires` chain with each node's state and input hash. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk explain <artifact>`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<artifact>` (required). Node id from pipeline.yaml, e.g. plan-verify, gate:design, execute-part:02.
- **Behaviour:** Mandatory from the first release (Approach A's debuggability requirement). A `stale` node names the hash that changed (P2).
- **Writes:** nothing
- **Output:** `schema/cli/output/explain.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk explain plan-verify --json
  ```

  ```json
  {
    "artifact": "plan-verify",
    "state": "blocked",
    "chain": [
      {
        "id": "plan-verify",
        "kind": "plan-verify",
        "state": "blocked",
        "requires": [
          "plan-part:01"
        ],
        "why": "plan-part:01 is ready, not done"
      },
      {
        "id": "plan-part:01",
        "kind": "plan-part",
        "state": "ready",
        "requires": [
          "gate:design"
        ]
      },
      {
        "id": "gate:design",
        "kind": "gate",
        "state": "done"
      }
    ]
  }
  ```

- **Owner:** T21
- **Slice:** `graph`

#### Scenario: example run

- **WHEN** `bdk explain plan-verify --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/explain.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk validate

Run an artifact's kind validator without marking it done. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk validate [<artifact>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<artifact>` (optional). Defaults to the artifact next returns.
- **Behaviour:** Exits 0 with `valid: false` and the failing checks when called on a valid-looking artifact that fails; exits 2 with the first failing rule when the caller asked for a verdict (`--json` consumers read `checks`, text mode prints them). Part validators (S1, P6) and the spec delta validator (T30) are reached through this command as well as through `done`.
- **Writes:** nothing
- **Output:** `schema/cli/output/validate.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/validation-failed`, `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/do-not-touch-overlap`, `policy/placeholder`, `policy/spec-invalid`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk validate plan-part:01 --json
  ```

  ```json
  {
    "artifact": "plan-part:01",
    "valid": true,
    "inputHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "checks": [
      {
        "id": "size",
        "ok": true
      },
      {
        "id": "tasks",
        "ok": true
      },
      {
        "id": "do-not-touch",
        "ok": true
      },
      {
        "id": "placeholders",
        "ok": true
      },
      {
        "id": "success-measure",
        "ok": true
      }
    ]
  }
  ```

- **Owner:** T21
- **Slice:** `graph`

#### Scenario: example run

- **WHEN** `bdk validate plan-part:01 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/validate.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/validation-failed

- **WHEN** a kind validator failed
- **THEN** the exit code is 2 and the error object carries `rule: policy/validation-failed`

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

#### Scenario: policy/spec-invalid

- **WHEN** a delta breaks the format
- **THEN** the exit code is 2 and the error object carries `rule: policy/spec-invalid`

### Requirement: bdk done

Mark an artifact done after its validator passes and record the input hash. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk done <artifact>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<artifact>` (required).
- **Behaviour:** `done` is the only way an artifact becomes done (defence against the existence-check anti-pattern): schema, non-emptiness and the kind's validator must pass, and the sha256 of the inputs is recorded so a later edit makes dependants `stale` (P2). For the plan and design nodes it regenerates `plan/index.md` or `design/index.md` from the parts (`kernel-state`, Plan part and plan index), and it writes a `transition` entry (`to: <artifact>`, `source: kernel`). A gate node cannot be marked done by this command: it refuses with `policy/gate-not-ready`, because a gate becomes done only through a `source: user` (or `source: policy`) transition entry.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/plan/index.md`, `.bdk/changes/<id>/design/index.md`, `.bdk/.machine/`
- **Output:** `schema/cli/output/done.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/validation-failed`, `policy/gate-not-ready`, `policy/missing-citation`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk done design --json
  ```

  ```json
  {
    "artifact": "design",
    "state": "done",
    "inputHash": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "next": "gate:design",
    "entry": "L-h6s1d"
  }
  ```

- **Owner:** T21
- **Slice:** `graph`

#### Scenario: example run

- **WHEN** `bdk done design --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/done.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/not-ready

- **WHEN** the artifact, part or task is blocked by an unfinished `requires` edge
- **THEN** the exit code is 2 and the error object carries `rule: policy/not-ready`

#### Scenario: policy/validation-failed

- **WHEN** a kind validator failed
- **THEN** the exit code is 2 and the error object carries `rule: policy/validation-failed`

#### Scenario: policy/gate-not-ready

- **WHEN** the gate node is not ready
- **THEN** the exit code is 2 and the error object carries `rule: policy/gate-not-ready`

#### Scenario: policy/missing-citation

- **WHEN** a PASS verdict cites no value that resolves inside the recorded evidence (T4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/missing-citation`
