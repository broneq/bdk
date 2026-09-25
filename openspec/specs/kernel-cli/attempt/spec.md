# kernel-cli/attempt Specification

## Purpose

Tickets and attempts (`attempt`). Every dispatch runs under a ticket (P4): `open` issues one or refuses with the next rung of the ladder, `close` records the outcome and performs the diff, evidence and entry checks, `list` reads the records and the budgets.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/budget-exhausted",
  "why": "loop task-redispatch for 02-3 used 3 of 3 attempts; the last two failed with the same fingerprint",
  "instead": [
    "bdk attempt open task-escalation 02-3",
    "bdk change park --reason \"02-3 exhausted\""
  ]
}
```

## Requirements

### Requirement: bdk attempt open

Open a ticket for one loop iteration, or refuse with the next rung of the ladder. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt open <loop> <target>`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<loop>` (required). Loop kind from policy: task-redispatch, verify-fix, review-fix, verifier, task-escalation.
  - `<target>` (required). Task, part or Change id.
- **Behaviour:** The kernel issues no dispatch package without an open ticket. Budgets per loop kind live in policy; `not-run` closes never consume them. Refuses with `policy/budget-exhausted` (instead: the escalation loop, then `change park`) and with `policy/oscillation` when the same finding fingerprint came back twice after a fix, which shortens the ladder regardless of remaining budget. Scope N+1 is a subset of scope N.
- **Writes:** `.bdk/changes/<id>/attempts/`
- **Output:** `schema/cli/output/attempt-open.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/budget-exhausted`, `policy/oscillation`, `policy/ticket-open`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt open task-redispatch 02-3 --json
  ```

  ```json
  {
    "ticket": "A-7f3k",
    "loop": "task-redispatch",
    "target": "02-3",
    "attempt": 2,
    "of": 3,
    "scope": "high+",
    "openedAt": "2026-09-25T10:02:11Z",
    "narrowedFrom": "full",
    "dropped": [
      {
        "id": "L-d3f6g",
        "summary": "rename helper for clarity"
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

- **WHEN** the artifact, part or task is blocked by an unfinished `requires` edge
- **THEN** the exit code is 2 and the error object carries `rule: policy/not-ready`

#### Scenario: policy/budget-exhausted

- **WHEN** the loop's budget is used up
- **THEN** the exit code is 2 and the error object carries `rule: policy/budget-exhausted`

#### Scenario: policy/oscillation

- **WHEN** the same finding fingerprint returned twice after a fix
- **THEN** the exit code is 2 and the error object carries `rule: policy/oscillation`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

### Requirement: bdk attempt close

Close a ticket with its outcome; check the diff, the evidence and the declared entries. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt close <ticket> ok|fail|not-run [--envelope <path>] [--reason <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket>` (required).
  - `ok|fail|not-run` (required). ok: done; fail: findings remain (fingerprints stored); not-run: the check could not be performed (P4).
  - `--envelope <path>`. The subagent's envelope file; its log ids and files are checked.
  - `--reason <text>`. Required with not-run: which precondition was missing.
- **Behaviour:** Reads the real diff and compares it with the task's `Files:` and the part's `do-not-touch` (P6): a forbidden path is a refusal, an undeclared file becomes a `finding` entry and `undeclared` in the output. Refuses when the envelope declares ledger ids that do not exist under the ticket, when evidence recorded for the task is older than the tree (P5), or when a PASS verdict cites nothing that resolves in the evidence (T4). `not-run` needs `--reason`, advances the ticket's `not-run` counter and, when that budget is exhausted, returns `next.action: question` with the entry id. `next` is the orchestrator's instruction: post-task steps, retry with the same scope, narrow, escalate, question or parked.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/attempt-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/do-not-touch`, `policy/entries-missing`, `policy/stale-evidence`, `policy/missing-citation`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt close A-7f3k fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-2.md --json
  ```

  ```json
  {
    "ticket": "A-7f3k",
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
      "L-e8k2s"
    ],
    "fingerprints": [
      "finding|src/auth/login.ts|verifyToken|expired token accepted"
    ],
    "next": {
      "action": "narrow",
      "scope": "blockers"
    }
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt close A-7f3k fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-2.md --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-close.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
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

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

### Requirement: bdk attempt list

Tickets and attempt records, open first. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt list [--for <task|part>] [--all]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--for <task|part>`.
  - `--all`.
- **Behaviour:** Reads the committed `attempts/` records, so it is correct on a fresh clone; the SQLite index only speeds it up.
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
        "ticket": "A-7f3k",
        "loop": "task-redispatch",
        "target": "02-3",
        "attempt": 2,
        "of": 3,
        "scope": "high+",
        "openedAt": "2026-09-25T10:02:11Z",
        "closedAt": "2026-09-25T10:19:40Z",
        "outcome": "fail"
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
