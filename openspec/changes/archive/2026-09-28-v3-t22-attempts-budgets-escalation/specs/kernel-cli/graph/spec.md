## MODIFIED Requirements

### Requirement: bdk validate

Run an artifact's kind validator without marking it done. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk validate [<artifact>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<artifact>` (optional). Defaults to the artifact next returns.
- **Behaviour:** Runs the kind's validator (`kernel-pipeline`, Artifact kinds) on the node's current files and returns every check with its result and the current input hash; never writes. Without an argument and with no actionable node it answers `input/not-found` naming what the Change waits for. Exits 0 with `valid: false` and the failing checks under `--json`; in text mode it prints the checks and exits 2 with the first failing rule. The plan part checks (`kernel-loops`, Plan part checks: `size`, `tasks`, `do-not-touch`, `placeholder`, `grammar`, `spec-impact`) run in the `plan-part` kind and the trailer and ticket checks in the `execute-part` kind; the spec delta validator (T30) plugs into its kind the same way, and until it lands `spec-delta` runs the baseline checks (files present, non-empty, schema valid, size). In text mode the exit code 2 carries the rule of the first failing check: `policy/part-too-large` for `size`, `policy/part-too-many-tasks` for `tasks`, `policy/do-not-touch-overlap` for `do-not-touch`, `policy/placeholder` for `placeholder`, `policy/validation-failed` for any other.
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

#### Scenario: validate writes nothing

- **WHEN** `bdk validate design --json` runs on a valid `design.md`
- **THEN** the output has `valid: true` and the ledger and the index hold no new entry

#### Scenario: part checks through validate

- **WHEN** `plan/parts/02-login.md` holds nine tasks and `bdk validate plan-part:02 --json` runs
- **THEN** the exit code is 0, `valid` is false and the check `tasks` fails naming 9 and the limit 8; in text mode the exit code is 2 with `rule: policy/part-too-many-tasks`
