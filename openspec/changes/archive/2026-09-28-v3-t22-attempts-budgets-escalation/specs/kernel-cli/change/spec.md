## MODIFIED Requirements

### Requirement: bdk change status

The active Change at a glance: stage, graph state, gate status with pending review entries, parked options. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change status`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Read-only, at most 100 lines in text mode. Shows which gates were passed by the user and which by policy (`passedBy`), an inferred intent as unconfirmed (`confirmed: false` while `change.md` carries `source: inferred` and the ledger holds no `transition` with `source: user`), the effective profile and stage derived from the ledger (`kernel-state`, Derived state and mutation), and, when parked, the options and the single resume command. This is the second place (after the previous stage skill's closing output) where the user sees pending `review: true` entries before typing the next stage command. `nodes` lists every node of the Change's graph in pipeline order with instances expanded, skipped nodes included, each with its state, requirements, recorded input hash and `why` (`kernel-pipeline`, Node states); `gates` lists every gate with `ready`, `done`, `passedBy`, `command` and the pending `review: true` entries (T21). In text mode the node list collapses done instances of one collection into one line so the 100-line limit holds. `parts` lists every plan part as `part list` does (`kernel-cli/part`, bdk part list), and is empty while the Change has no plan parts.
- **Writes:** nothing
- **Output:** `schema/cli/output/change-status.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change status --json
  ```

  ```json
  {
    "change": "2026-09-25-add-passwordless-login",
    "kind": "feature",
    "profile": "small",
    "source": "user",
    "confirmed": true,
    "stage": "design",
    "nodes": [
      {
        "id": "design",
        "kind": "design",
        "state": "done"
      },
      {
        "id": "gate:design",
        "kind": "gate",
        "state": "ready"
      }
    ],
    "gates": [
      {
        "gate": "gate:design",
        "ready": true,
        "done": false,
        "command": "/bdk:plan",
        "pending": [
          {
            "id": "L-k3d8p2wz",
            "type": "question",
            "summary": "Keep magic links or add WebAuthn?",
            "status": "proposed",
            "source": "agent:design-verifier",
            "at": "2026-09-25T09:41:07Z",
            "refs": [
              "design.md"
            ],
            "review": true
          }
        ]
      }
    ],
    "parts": [
      {
        "part": "01",
        "title": "Token service",
        "state": "ready",
        "tasks": 4,
        "done": 0,
        "bytes": 5120,
        "specImpact": "none",
        "wave": 1
      }
    ]
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change status --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-status.json`

#### Scenario: inferred intent is unconfirmed

- **WHEN** the active Change was opened with `change new --inferred` and the ledger holds no `transition` with `source: user`
- **THEN** `change status --json` answers `source: inferred` and `confirmed: false`, and the text form marks the intent as unconfirmed

#### Scenario: at most 100 lines

- **WHEN** `change status` runs in text mode on a Change with 1 000 ledger entries, a parked question with options and pending review entries
- **THEN** the output has at most 100 lines

#### Scenario: graph in the status

- **WHEN** a `small` feature Change has `design` done and `gate:design` not passed
- **THEN** `change status --json` lists `intent` and `design` as `done`, `gate:design` as `ready`, `plan` as `blocked`, and `gates` holds `gate:design` with `command: /bdk:plan` and `gate:review` with `ready: false`

#### Scenario: gate passed by policy

- **WHEN** `policy.gates.design` is `auto` and a `source: policy` transition passed `gate:design`
- **THEN** the `gates` entry of `gate:design` has `passedBy: policy`, and the text form says the gate was passed by policy

#### Scenario: parts in the status

- **WHEN** a Change has plan parts `01` (done) and `02` (started, one of three tasks committed)
- **THEN** `change status --json` lists both in `parts` with the same `state`, `tasks` and `done` values as `part list --json`

### Requirement: bdk change park

Park the active Change with a question or blocker entry, options and one resume command. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change park [--reason <text>] [--option <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--reason <text>`. Becomes the summary of the question entry.
  - `--option <text>`. Repeatable; at least one. Defaults are accept as debt, change decision X, split part.
- **Behaviour:** Called by the orchestrator when the escalation ladder ends (A-drabina) or by the user through `/bdk:change park`. Writes the `question` entry with `park: true`, the options and `source: kernel` (summary from `--reason`, default `Change parked: choose how to continue`, at most 120 characters), then runs the checkpoint (`kernel-loops`, Checkpoint; V-checkpoint) and reports it in `checkpoint`: `{done: true, commit}`, or `{done: false, skipped: <reason>}` when it was skipped (disabled by policy, nothing changed, a rebase, merge or cherry-pick in progress, or a failing git hook); a skipped checkpoint never fails the park. The ladder's end in `attempt close` writes the same kind of `question` itself (`kernel-loops`, Escalation ladder), so `change park` is for a user or orchestrator decision outside a loop. Refuses while a ticket is open (an attempt record without `outcome`): close or `attempt close not-run` first. Refuses a Change that is already parked with `policy/invalid-transition`.
- **Writes:** `.bdk/changes/<id>/log/`, `git:commit`
- **Output:** `schema/cli/output/change-park.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change park --reason "02-3 exhausted its budget" --option "accept as debt" --option "split part 02" --json
  ```

  ```json
  {
    "change": "2026-09-25-add-passwordless-login",
    "entry": "L-t4w7n3kd",
    "options": [
      "accept as debt",
      "split part 02"
    ],
    "resume": "bdk change resume 2026-09-25-add-passwordless-login --option <n>",
    "checkpoint": {
      "done": true,
      "commit": "a1b2c3d"
    }
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change park --reason "02-3 exhausted its budget" --option "accept as debt" --option "split part 02" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-park.json`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: park commits the Change directory

- **WHEN** `policy.checkpoint.enabled` is true, no ticket is open, and `bdk change park --reason "waiting for API keys" --json` runs
- **THEN** `checkpoint.done` is true, `checkpoint.commit` is the new `HEAD`, and that commit contains the park question under `.bdk/changes/<id>/log/`

### Requirement: bdk change takeover

Take over a Change whose previous session died with open tickets. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change takeover [--close-tickets]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--close-tickets`. Close every open ticket as not-run instead of refusing.
- **Behaviour:** Today's `--force`. Without an open ticket there is nothing to take over: `policy/invalid-transition` with `instead` naming `bdk rebuild`. Without `--close-tickets` it refuses with `policy/ticket-open` listing the open tickets. With it, each open ticket is closed as `not-run` with the body `taken over` (its round's `not-run` counter advances, budgets stay; `kernel-loops`, Not-run outcome), a kernel `transition` entry to the Change's current stage records the takeover with the closed tickets in `refs`, and the rebuild of `bdk rebuild` runs for the Change. The kernel cannot yet tell whether the session that opened a ticket is alive, because session ids reach it only through T24's hooks; until then `previousSession` is absent and the orchestrator runs takeover only after the user confirmed the previous session is gone.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/`, `.bdk/.machine/`, `.bdk/rules/`
- **Output:** `schema/cli/output/change-takeover.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change takeover --close-tickets --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "closedTickets": [
      "A-7f3k9m2q"
    ],
    "rebuilt": true
  }
  ```

- **Owner:** T22
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change takeover --close-tickets --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-takeover.json`

#### Scenario: policy/invalid-transition

- **WHEN** the Change has no open ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/invalid-transition` and `instead` names `bdk rebuild`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is open and `--close-tickets` is not given
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open` listing the ticket

#### Scenario: state/trailer-mismatch

- **WHEN** the rebuild finds trailers that disagree with the plan or the attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: taken-over ticket keeps the budget

- **WHEN** ticket `A-7f3k9m2q` of `task-redispatch 02-3` is open after one failed attempt and `bdk change takeover --close-tickets` runs
- **THEN** the ticket's record has `outcome: not-run` and body `taken over`, `attempt list --for 02-3` shows `budgets.task-redispatch.used: 1` and `budgets.not-run.used: 1`, and a new `attempt open task-redispatch 02-3` exits 0

### Requirement: bdk change checkpoint

Pathspec commit of the Change directory: `chore(bdk): checkpoint <change>`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change checkpoint`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Stages `.bdk/changes/<id>/` and commits only that path with a pathspec commit, subject `chore(bdk): checkpoint <id>`, so files the user staged are never swept in (V1-4; `kernel-loops`, Checkpoint). Exits 0 with `done: false` and `skipped` naming the reason when `policy.checkpoint.enabled` is false or nothing under the Change directory changed. Refuses during a rebase, merge or cherry-pick (`policy/git-in-progress`), while a ticket is open (`policy/ticket-open`: subagents may still be writing) and when a git hook fails (`policy/git-hook-failed`, no commit created). `change park`, `attempt open --escalate` and the end of the ladder in `attempt close` run the same checkpoint and report those three cases as `skipped` instead of refusing; `hooks session-end` calls it from T24.
- **Writes:** `git:commit`
- **Output:** `schema/cli/output/change-checkpoint.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/git-in-progress`, `policy/git-hook-failed`, `policy/ticket-open`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change checkpoint --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "done": true,
    "commit": "a1b2c3d"
  }
  ```

- **Owner:** T22
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change checkpoint --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-checkpoint.json`

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress (V1-4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-in-progress`

#### Scenario: policy/git-hook-failed

- **WHEN** the repository's `commit-msg` hook rejects the message
- **THEN** the exit code is 2, the error object carries `rule: policy/git-hook-failed` and `HEAD` is unchanged

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: nothing to checkpoint

- **WHEN** the Change directory has no change since the last commit
- **THEN** the exit code is 0, `done` is false, `skipped` says nothing changed and `HEAD` is unchanged

#### Scenario: user's staged files stay out

- **WHEN** the user staged `src/app.ts` and `bdk change checkpoint` creates a commit
- **THEN** the commit's paths are all under `.bdk/changes/<id>/` and `src/app.ts` is still staged
