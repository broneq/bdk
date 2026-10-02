# kernel-cli/attempt Specification

## Purpose

Tickets and attempts (`attempt`). Every dispatch runs under a ticket (P4): `open` issues one or refuses with the next rung of the ladder, `close` records the outcome and performs the diff, evidence and entry checks, `list` reads the records and the budgets.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/budget-exhausted",
  "why": "task-redispatch 02-3 used 3 of 3 attempts in this round",
  "instead": ["bdk attempt open task-redispatch 02-3 --escalate"]
}
```

## Requirements

### Requirement: bdk attempt open

Open a ticket for one loop iteration, or refuse with the next rung of the ladder. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt open <loop> <target> [--escalate]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<loop>` (required). Loop kind from policy: task-redispatch, verify-fix, review-fix, verifier.
  - `<target>` (required). Task id for task-redispatch, part id for verify-fix, the Change id for review-fix, an artifact id for verifier.
  - `--escalate`. Open the round's one-shot escalation ticket (A-drabina); allowed only when the round's budget is used up or it oscillates.
- **Behaviour:** The kernel issues no dispatch package without an open ticket. Counts, rounds, scopes and the ladder follow `kernel-loops`. The ticket id is a merge-safe `A-` id (`kernel-state`, Identifiers); the record is written to `attempts/<loop>-<target>-<ticket>.md` with `attempt`, `of`, `scope`, `narrowed-from` and `dropped` stamped by the kernel. A task or part target needs its part started (`part start`), a `verifier` target an artifact node that is not `blocked` or `skipped`, and a `review-fix` target the `review` node not `blocked`; otherwise `policy/not-ready`. An unknown task, part or artifact is `input/not-found`; a target of the wrong type for the loop is `input/invalid-argument`. Refuses with `policy/ticket-open` while a ticket of the same loop and target is open; tickets of other targets may be open at the same time (parallel waves). A `task-redispatch` or `verify-fix` open refuses with `policy/files-busy` when a path of its target's `Files:` (a task's, or every task's of a part) covers or is covered by a path of the `Files:` of another open `task-redispatch` or `verify-fix` ticket, naming the path and that ticket: parts and tasks share one working tree, so two open tickets never hold one file (T41). After writing, the kernel checks again and removes its own record when an overlapping ticket was opened at the same time. A plain open refuses with `policy/budget-exhausted` when the round's budget is used up and with `policy/oscillation` when the round oscillates, `instead` naming `--escalate` when escalation is available (`kernel-loops`, Escalation ladder) and otherwise `change resume`. `--escalate` when the round's budget is not used up and the round does not oscillate, when escalation is disabled, already used in the round or over `policy.escalation.per-change`, is `policy/invalid-transition` naming the reason. An escalation ticket carries `escalation: true`, does not count against `of`, keeps the round's latest scope and returns `escalation.model` from `policy.escalation.model`; the checkpoint runs before it is issued (`kernel-loops`, Checkpoint). Narrowing drops findings as `kernel-loops`, Scope narrowing says, writing one kernel `finding` entry. After writing, the kernel re-reads the records of the key; when another open ticket of the key exists it removes its own record and refuses `policy/ticket-open`. For the loops that change code (`task-redispatch`, `verify-fix`, `review-fix`) the output lists `steps`: the post-task step nodes of the pipeline that apply to the Change, in pipeline order, each with its evidence `kind` and the `role` that runs it (`kernel-pipeline`, Artifact kinds), which the orchestrator dispatches under this ticket after the implementer returns (T23-D41); the `verifier` loop has no `steps`.
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

### Requirement: bdk attempt close

Close a ticket with its outcome; check the diff, the evidence and the declared entries. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt close <ticket> ok|fail|not-run [--envelope <path>] [--reason <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket>` (required).
  - `ok|fail|not-run` (required). ok: done; fail: findings remain (fingerprints stored); not-run: the check could not be performed (P4).
  - `--envelope <path>`. The subagent's envelope file; its entry ids are checked.
  - `--reason <text>`. Required with not-run: which precondition was missing. Written as the record's body.
- **Behaviour:** Runs the diff check of `kernel-loops`, Diff check, for the ticket's target: a forbidden path is a refusal and leaves the ticket open; undeclared files become one kernel `finding` entry and `diff.undeclared` in the output. With `--envelope`, the report's `entries` must all exist under the ticket (entries whose `ticket` is this ticket, written by `log add --ticket`; `log ingest` refuses such a report before it is stored); missing ids refuse with `policy/entries-missing` naming them. A `fail` stores the fingerprints of the ticket's `finding` and `blocker` entries (`kernel-loops`, Finding fingerprints and oscillation). `not-run` needs `--reason` (`input/missing-argument`) and advances the round's `not-run` counter without consuming the budget. The close stamps `closed-at` and `outcome` in place (`kernel-state`, Derived state and mutation). `next` is the orchestrator's instruction from `kernel-loops`, Escalation ladder: `commit`, `retry`, `narrow` with the next scope, `escalate`, or `parked`; for `parked` the kernel writes the ladder question (`question`, `park: true`, `review: true`, `source: kernel`, options, `refs` naming the target and the tickets of the round), runs the checkpoint, and `next` carries the entry id and the resume command. When the ticket's dispatch package names the role `implementer` and its attempt record has no `rules-read` (`kernel-cli/rules`, `rules show --ticket`), the close writes one kernel `finding` with `review: true`, summary `implementer closed <ticket> without reading its rules`, refs naming the target and the ticket, and returns its id as `rulesFinding`; the close itself goes on (risk R2). Evidence checks (P5, T4, T23-D41): an `ok` close of a ticket that holds an `implementer` or a `simplifier` package (a code ticket; a `verify-fix` ticket that reruns the steps of a done part holds no `implementer` package) first records the `simplify` manifest from the ticket's stored `simplifier` report (`source: kernel`, the report as its one committed file, the tree hash of the target, verdict `pass` for `status: done` or `done-with-concerns` and `not-run` for `blocked` or `needs-context`; no citation, as kernel evidence cites nothing), then checks every post-task step kind the pipeline applies, in pipeline order: the ticket's latest manifest of the kind must exist with verdict `pass` or `not-run` (`policy/missing-evidence` otherwise, naming the kind, with `instead` naming `attempt close <ticket> fail` for a `fail` verdict and the step's role for a missing one), must be fresh against the current tree hash of the target (`policy/stale-evidence` naming the kind and the changed files), and, for `pass`, must carry at least one citation and still hold every `stored: committed` file with its recorded hash (`policy/missing-citation`). A `not-run` step verdict is accepted while the part of the target (every part for the Change) holds at most `policy.budgets.not-run` `not-run` manifests of that kind; past it the close is `policy/missing-evidence` with `instead` naming `attempt close <ticket> not-run --reason`. A `fail` or `not-run` close runs no evidence check, and any refusal leaves the ticket open. A ticket that does not exist is `input/not-found`; a closed one is `policy/no-open-ticket`.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/evidence/`, `git:commit`
- **Output:** `schema/cli/output/attempt-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/do-not-touch`, `policy/entries-missing`, `policy/stale-evidence`, `policy/missing-citation`, `policy/missing-evidence`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt close A-7f3k9m2q fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3k9m2q.md --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "outcome": "fail",
    "diff": {
      "declared": [
        "src/auth/login.ts"
      ],
      "touched": [
        "src/auth/login.ts",
        "src/auth/util.ts"
      ],
      "undeclared": [
        "src/auth/util.ts"
      ]
    },
    "findings": [
      "L-e8k2s5vw"
    ],
    "fingerprints": [
      "sha256:3f1c9a0b7d2e4c6f8a1b3d5e7f9a0c2e4b6d8f0a1c3e5a7b9d1f3a5c7e9b1d3f"
    ],
    "notRunCount": 0,
    "next": {
      "action": "narrow",
      "scope": "blockers"
    }
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt close A-7f3k9m2q fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3k9m2q.md --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-close.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket named is already closed
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/do-not-touch

- **WHEN** the real diff touches a `do-not-touch` path (P6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/do-not-touch`

#### Scenario: policy/entries-missing

- **WHEN** the envelope declares ledger ids that do not exist under this ticket
- **THEN** the exit code is 2 and the error object carries `rule: policy/entries-missing`

#### Scenario: policy/stale-evidence

- **WHEN** the evidence manifest is older than the last code change (P5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/stale-evidence`

#### Scenario: policy/missing-citation

- **WHEN** a PASS verdict cites no value that resolves inside the recorded evidence (T4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/missing-citation`

#### Scenario: policy/missing-evidence

- **WHEN** a code ticket closes `ok` and its latest `lint` manifest has verdict `fail`, or it has no `lint` manifest
- **THEN** the exit code is 2, the error object carries `rule: policy/missing-evidence` naming `lint`, and the ticket stays open

#### Scenario: stale step evidence refused

- **WHEN** the runner recorded `tests-scoped` and `lint` for `02-3` and a file of the part changed before `bdk attempt close <ticket> ok`
- **THEN** the exit code is 2 with `rule: policy/stale-evidence` naming the kinds and the changed file

#### Scenario: fresh cited evidence closes the ticket

- **WHEN** a code ticket has a stored `simplifier` report with `status: done` and fresh `tests-scoped` and `lint` manifests with `pass` and a resolving citation, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, a `simplify` manifest with `source: kernel` and verdict `pass` exists for the target, and `next.action` is `commit`

#### Scenario: not-run within budget

- **WHEN** the `lint` manifest of a code ticket has verdict `not-run` and the part holds no other `not-run` `lint` manifest
- **THEN** `attempt close <ticket> ok` exits 0

#### Scenario: steps of a done part rerun under verify-fix

- **WHEN** a file of done part 01 changed after its steps were recorded, `bdk attempt open verify-fix 01` opened a ticket, the simplifier's report is stored under it, the runner recorded fresh cited `tests-scoped` and `lint` manifests under it, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, the kernel recorded a `simplify` manifest of target `01`, and `simplify:01`, `tests-scoped:01` and `lint:01` are `done`

#### Scenario: verifier ticket needs no step evidence

- **WHEN** a ticket holding only a `verifier` package closes `ok` with no manifest
- **THEN** the exit code is 0

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: fingerprints stored on fail

- **WHEN** a ticket closes `fail` with two `finding` entries under it, one referencing `src/auth/login.ts#verifyToken` and one referencing only `02-3`
- **THEN** the record's `findings` holds one item with `file: src/auth/login.ts`, `symbol: verifyToken` and its fingerprint

#### Scenario: implementer closed without reading rules

- **WHEN** an `implementer` ticket whose attempt record has no `rules-read` closes `ok`
- **THEN** the exit code is 0, the ticket is closed, and one kernel `finding` with `review: true` names the target and the ticket and its id is `rulesFinding`

#### Scenario: rules read before close

- **WHEN** the same ticket ran `bdk rules show --ticket` before closing
- **THEN** no rules finding is written and `rulesFinding` is absent

### Requirement: bdk attempt list

Tickets and attempt records, open first. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt list [--for <task|part>] [--all]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--for <task|part>`. Records whose target is the task, or the part and its tasks.
  - `--all`. Every round, not only the current one of each loop and target.
- **Behaviour:** Reads the committed `attempts/` records, so it is correct on a fresh clone; the SQLite index only speeds it up. Open tickets first, then by `openedAt` newest first; at most 100 lines in text mode. `budgets` holds, for each loop with a record in scope, `used` and `of` of its current round, and `not-run` the round's consecutive `not-run` counter against `policy.budgets.not-run`; with `--for` naming a task, `entries` counts the ledger entries written under each listed ticket.
- **Writes:** nothing
- **Output:** `schema/cli/output/attempt-list.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt list --for 02-3 --json
  ```

  ```json
  {
    "items": [
      {
        "ticket": "A-7f3k9m2q",
        "loop": "task-redispatch",
        "target": "02-3",
        "attempt": 2,
        "of": 3,
        "scope": "high+",
        "openedAt": "2026-09-25T10:02:11.482Z",
        "closedAt": "2026-09-25T10:19:40.917Z",
        "outcome": "fail",
        "entries": 2
      }
    ],
    "total": 1,
    "truncated": false,
    "for": "02-3",
    "budgets": {
      "task-redispatch": {
        "used": 2,
        "of": 3
      },
      "not-run": {
        "used": 0,
        "of": 3
      }
    }
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt list --for 02-3 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-list.json`

#### Scenario: open tickets first

- **WHEN** the Change holds one open ticket and three closed records
- **THEN** the first item is the open ticket and has no `closedAt`
