# Spec Delta

## MODIFIED Requirements

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
