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
- **Behaviour:** Inject mode: called from stage skills' `!` blocks and by `hooks prompt-expansion`. Always exits 0; never writes. Returns the first node in pipeline order that is `ready` or `stale` and not sealed by a done gate (`kernel-pipeline`, Node states), with its instruction (`kernel-pipeline`, Instruction), and the status of every gate of the Change's graph. An instance collection without instances (no plan part written yet) is returned as the collection itself (`plan`). When that node is an `execute-part` instance, the output also carries `wave`: one item per `execute-part` instance that is `ready` or `stale`, in part order, each with `part`, `started` (the part has a `part start` marker), `tickets` (the ids of its open `part-lead` and `task-redispatch` tickets) and `mode`, `tree` or `flat` (T41-D3). A part with an open `part-lead` ticket is `tree`; any other started part is `flat`; a part not started is `tree` exactly when the effective profile is `large`, `execution.tree.enabled` is true and the listed parts not started number at least `execution.tree.min-parts` (`kernel-settings`, Keys of execution and archive), and `flat` otherwise. `artifact` and `instruction` stay those of the first instance. Without an actionable node it says what the Change waits for: `waiting: gate` when a gate is ready and not done (the Markdown output is then the gate status the previous stage skill shows the user: the command to type and the pending `review: true` entries with ids and summaries), `waiting: user` when the Change is parked (with the park question and the resume command), `waiting: nothing` when every node is done. A refusal a Change-scoped command would emit (no active Change, invalid ledger) is rendered as a STOP block with exit 0 (`kernel-cli`, Output modes).
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

#### Scenario: new small Change asks for the design

- **WHEN** `bdk change new "Add passwordless login"` has just run and `bdk next --json` runs
- **THEN** `artifact.id` is `design`, `artifact.state` is `ready` and `instruction` names `bdk done design`

#### Scenario: waiting at the design gate

- **WHEN** `design` and `architecture` are done and no transition names `gate:design`
- **THEN** there is no `artifact`, `waiting` is `gate`, and the gate entry has `ready: true`, `done: false`, `command: /bdk:plan` and the pending `review: true` entries

#### Scenario: gate passed by the user

- **WHEN** a fixture then inserts a `transition` with `gate: gate:design`, `to: plan` and `source: user`
- **THEN** `artifact.id` is `plan` and the gate entry has `done: true` and `passedBy: user`

#### Scenario: two independent parts of a large Change

- **WHEN** a `large` Change has done `plan` and `plan-verify`, plan parts `01` and `02` without `depends-on`, neither started, and `bdk next --json` runs with the default settings
- **THEN** `artifact.id` is `execute-part:01` and `wave` lists `01` and `02`, each with `started: false`, `tickets: []` and `mode: tree`

#### Scenario: small Change stays flat

- **WHEN** the same plan belongs to a `small` Change
- **THEN** `wave` lists `01` and `02` with `mode: flat`

#### Scenario: tree disabled

- **WHEN** the Change is `large` and `.bdk/settings.yaml` sets `execution.tree.enabled: false`
- **THEN** both parts have `mode: flat`

#### Scenario: a running lead keeps its mode

- **WHEN** part `01` of that `large` Change is started with an open `part-lead` ticket, part `02` is done, and part `03`, which depends on `02`, is ready and not started
- **THEN** `wave` lists `01` with `mode: tree` and its ticket, and `03` with `mode: flat`, since one part not started is below `execution.tree.min-parts`

#### Scenario: dependent part waits

- **WHEN** part `02` depends on part `01` and part `01` is not done
- **THEN** `wave` lists only `01`

#### Scenario: no wave outside execute

- **WHEN** the next node is `plan-verify`
- **THEN** the output has no `wave`

#### Scenario: parked Change

- **WHEN** the Change is parked
- **THEN** there is no `artifact`, `waiting` is `user` and the Markdown names `bdk change resume <id> --option <n>`

### Requirement: bdk explain

Why an artifact is in its state: the `requires` chain with each node's state and input hash. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk explain <artifact>`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<artifact>` (required). Node id from pipeline.yaml, e.g. plan-verify, gate:design, execute-part:02.
- **Behaviour:** Mandatory from the first release (Approach A's debuggability requirement). The chain starts at the artifact and walks its `requires` depth first in pipeline order, each node once, with its kind, state, requirements, recorded input hash and `why` for `blocked`, `stale` and `skipped` nodes (for `skipped`: which field or kind rule removed it). A `stale` node names the recorded and the current hash (P2); a gate names its ready time, the entries that pass it and `passedBy`, or why none counts (older than the ready time, wrong `source`, `manual` policy). A node id that exists in the pipeline but not in this Change's variant is answered as `skipped`, not `input/not-found`.
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
    "profile": "small",
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

#### Scenario: chain of plan-verify

- **WHEN** a `small` Change has passed `gate:design`, part `01` is done and part `02` is ready, and `bdk explain plan-verify` runs
- **THEN** the chain lists `plan-verify` (`blocked`, why naming `plan-part:02`), `plan-part:01`, `plan-part:02`, `gate:design`, `architecture`, `design` and `intent`, each once with its state

#### Scenario: skipped node

- **WHEN** `bdk explain design` runs on a `tiny` Change
- **THEN** the exit code is 0, the state is `skipped` and `why` names the profile

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

### Requirement: bdk done

Mark an artifact done after its validator passes and record the input hash. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk done <artifact>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<artifact>` (required).
- **Behaviour:** `done` is the only way an artifact becomes done (defence against the existence-check anti-pattern): the node must be `ready` or `stale`, and schema, non-emptiness and the kind's validator must pass; then it writes a `transition` entry (`to: <artifact>`, `source: kernel`, `input-hash` the sha256 of the node's inputs, `refs` the node id and its files), so a later edit makes the node `stale` (P2). An unchanged node that is already done is answered with its existing entry and no write (idempotent). For an instance collection (`plan`, `design-parts`) it marks every ready instance in id order and refuses on the first that fails. For the plan and design nodes it regenerates `plan/index.md` or `design/index.md` from the parts (`kernel-state`, Plan part and plan index). On a `small` Change whose design is split into `design/parts/` with no `design.md`, `done design` writes a `decision` with `profile: large` instead of a transition (`kernel-pipeline`, Graph variants). `next` in the output is what `bdk next` returns afterwards: an artifact id, or the gate id the Change waits for. A gate node cannot be marked done by this command: it refuses with `policy/gate-not-ready`, because a gate becomes done only through a `source: user` (or `source: policy`) transition entry. A node of a kind done through another command (`intent`, `execute-part`, `post-task-step`, `close`) refuses with `policy/invalid-transition` naming that command.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/plan/index.md`, `.bdk/changes/<id>/design/index.md`, `.bdk/.machine/`
- **Output:** `schema/cli/output/done.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/validation-failed`, `policy/gate-not-ready`, `policy/missing-citation`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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
    "entry": "L-h6s1d3ne"
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

#### Scenario: policy/invalid-transition

- **WHEN** `bdk done execute-part:01` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/invalid-transition` and `instead` names `bdk part done 01`

#### Scenario: hash recorded

- **WHEN** `bdk done design` succeeds
- **THEN** the ledger holds one new `transition` with `to: design`, `source: kernel` and `input-hash` equal to the output's `inputHash`, and `change status` shows `design` as `done`
