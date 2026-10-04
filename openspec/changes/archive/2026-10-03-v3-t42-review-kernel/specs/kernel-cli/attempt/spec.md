## MODIFIED Requirements

### Requirement: bdk attempt open

Open a ticket for one loop iteration, or refuse with the next rung of the ladder. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt open <loop> <target> [--escalate]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<loop>` (required). Loop kind from policy: task-redispatch, verify-fix, review-fix, verifier.
  - `<target>` (required). Task id for task-redispatch, part id for verify-fix, the Change id for review-fix, an artifact id for verifier.
  - `--escalate`. Open the round's one-shot escalation ticket (A-drabina); allowed only when the round's budget is used up or it oscillates.
- **Behaviour:** The kernel issues no dispatch package without an open ticket. Counts, rounds, scopes and the ladder follow `kernel-loops`. The ticket id is a merge-safe `A-` id (`kernel-state`, Identifiers); the record is written to `attempts/<loop>-<target>-<ticket>.md` with `attempt`, `of`, `scope`, `narrowed-from` and `dropped` stamped by the kernel. A task or part target needs its part started (`part start`), a `verifier` target an artifact node that is not `blocked` or `skipped`, and a `review-fix` target every requirement of the `review` node done or skipped, except the change-level checks `tests-full` and `lint-full`, which the round's gate runner records (`kernel-pipeline`, Artifact kinds; T42), so the first not-done requirement is named in `policy/not-ready`; otherwise `policy/not-ready`. An unknown task, part or artifact is `input/not-found`; a target of the wrong type for the loop is `input/invalid-argument`. Refuses with `policy/ticket-open` while a ticket of the same loop and target is open; tickets of other targets may be open at the same time (parallel waves). A `task-redispatch` or `verify-fix` open refuses with `policy/files-busy` when a path of its target's `Files:` (a task's, or every task's of a part) covers or is covered by a path of the `Files:` of another open `task-redispatch` or `verify-fix` ticket, naming the path and that ticket: parts and tasks share one working tree, so two open tickets never hold one file (T41). After writing, the kernel checks again and removes its own record when an overlapping ticket was opened at the same time. A plain open refuses with `policy/budget-exhausted` when the round's budget is used up and with `policy/oscillation` when the round oscillates, `instead` naming `--escalate` when escalation is available (`kernel-loops`, Escalation ladder) and otherwise `change resume`. `--escalate` when the round's budget is not used up and the round does not oscillate, when escalation is disabled, already used in the round or over `policy.escalation.per-change`, is `policy/invalid-transition` naming the reason. An escalation ticket carries `escalation: true`, does not count against `of`, keeps the round's latest scope and returns `escalation.model` from `policy.escalation.model`; the checkpoint runs before it is issued (`kernel-loops`, Checkpoint). Narrowing drops findings as `kernel-loops`, Scope narrowing says, writing one kernel `finding` entry. After writing, the kernel re-reads the records of the key; when another open ticket of the key exists it removes its own record and refuses `policy/ticket-open`. For the loops that change code (`task-redispatch`, `verify-fix`, `review-fix`) the output lists `steps`: the post-task step nodes of the pipeline that apply to the Change, in pipeline order, each with its evidence `kind` and the `role` that runs it (`kernel-pipeline`, Artifact kinds), which the orchestrator dispatches under this ticket after the implementer returns (T23-D41); the `verifier` loop has no `steps`.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `git:commit`
- **Output:** `schema/cli/output/attempt-open.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/budget-exhausted`, `policy/oscillation`, `policy/ticket-open`, `policy/files-busy`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt open task-redispatch 02-3 --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "loop": "task-redispatch",
    "target": "02-3",
    "attempt": 2,
    "of": 3,
    "scope": "high+",
    "openedAt": "2026-09-25T10:02:11.482Z",
    "narrowedFrom": "full",
    "dropped": [
      {
        "id": "L-d3f6g8h2",
        "summary": "rename helper for clarity"
      }
    ],
    "steps": [
      {
        "kind": "simplify",
        "role": "simplifier"
      },
      {
        "kind": "tests-scoped",
        "role": "runner"
      },
      {
        "kind": "lint",
        "role": "runner"
      }
    ]
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt open task-redispatch 02-3 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-open.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/not-ready

- **WHEN** `bdk attempt open task-redispatch 02-3` runs before `bdk part start 02`
- **THEN** the exit code is 2, the error object carries `rule: policy/not-ready` and `instead` names `bdk part start 02`

#### Scenario: policy/budget-exhausted

- **WHEN** the loop's budget is used up
- **THEN** the exit code is 2 and the error object carries `rule: policy/budget-exhausted`

#### Scenario: policy/oscillation

- **WHEN** one finding fingerprint appears in `policy.oscillation.threshold` failed attempts of the round
- **THEN** the exit code is 2 and the error object carries `rule: policy/oscillation`

#### Scenario: policy/ticket-open

- **WHEN** a ticket of the same loop and target is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: policy/invalid-transition

- **WHEN** `bdk attempt open task-redispatch 02-3 --escalate` runs while the round has budget left and does not oscillate
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: parallel targets

- **WHEN** a ticket of `task-redispatch 02-3` is open and `bdk attempt open task-redispatch 02-4` runs
- **THEN** the exit code is 0

#### Scenario: escalation ticket

- **WHEN** the round of `task-redispatch 02-3` has used its budget, escalation is enabled and `bdk attempt open task-redispatch 02-3 --escalate --json` runs
- **THEN** the exit code is 0, the record has `escalation: true`, the output has `escalation.model: opus` under the default policy, and a second `--escalate` in the same round is `policy/invalid-transition`

#### Scenario: steps in pipeline order

- **WHEN** `bdk attempt open task-redispatch 02-3 --json` runs on a Change with the shipped pipeline
- **THEN** `steps` is `simplify` (`simplifier`), `tests-scoped` (`runner`), `lint` (`runner`), in that order

#### Scenario: verifier ticket has no steps

- **WHEN** `bdk attempt open verifier plan-verify --json` runs
- **THEN** the output has no `steps`

#### Scenario: policy/files-busy

- **WHEN** tasks `01-1` and `01-2` both declare `src/login.ts`, part `01` is started and ticket `A-xxxxxxxx` of `task-redispatch 01-1` is open
- **THEN** `attempt open task-redispatch 01-2` exits 2 with `rule: policy/files-busy` naming `src/login.ts` and `A-xxxxxxxx`, and after that ticket is closed the same open exits 0

#### Scenario: a review round opens before the full gate

- **WHEN** every plan part of a Change is executed with its post-task steps, `tests-full` and `lint-full` have no manifest, and `bdk attempt open review-fix <change-id> --json` runs
- **THEN** the ticket opens, although `review` is `blocked` on `tests-full`

#### Scenario: a review round waits for execute

- **WHEN** part `02` is started and not done, and `bdk attempt open review-fix <change-id>` runs
- **THEN** the exit code is 2 with `rule: policy/not-ready` naming `execute-part:02`, and `instead` is `bdk explain execute-part:02`
