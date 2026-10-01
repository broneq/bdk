## MODIFIED Requirements

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
