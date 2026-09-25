# kernel-cli/log Specification

## Purpose

Ledger (`log`). The append-only ledger of the Change (K2, P1): `add` writes one entry, `ingest` writes a read-only role's block under its ticket, `list` and `show` read, `resolve` changes a status, `route` sorts `learning` entries at close.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/forbidden-field",
  "why": "--source is not a flag of log add: source is stamped from the ticket's role (P1)",
  "instead": [
    "bdk log add finding \"...\" --ref <ref> --ticket A-7f3k",
    "bdk log add --help"
  ]
}
```

## Requirements

### Requirement: bdk log add

Append one ledger entry; the kernel stamps id, time, author and source. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log add decision|finding|observation|blocker|question|assumption|risk|learning|report <summary> [--ref <ref>] [--body <text>] [--ticket <ticket>] [--review] [--supersedes <id>] [--status proposed|accepted|superseded|resolved|routed]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `decision|finding|observation|blocker|question|assumption|risk|learning|report` (required).
  - `<summary>` (required). <= 120 characters.
  - `--ref <ref>`. Repeatable; at least one (file, symbol, part, task, rule or entry id).
  - `--body <text>`. Markdown body; - reads it from stdin.
  - `--ticket <ticket>`. The ticket the caller works under; required inside a dispatch, sets source: agent:<role>.
  - `--review`. Mark the entry to be shown at the next gate.
  - `--supersedes <id>`.
  - `--status proposed|accepted|superseded|resolved|routed`.
  - stdin: Body text when --body - is given.
- **Behaviour:** Available to subagents (worker and runner roles write their own entries, T2). `type: transition` is not accepted here and `--source` does not exist: `source` is derived from the ticket's role, or is `kernel` for the main thread without a ticket; passing `id`, `at`, `author` or `source` in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). Validation: type from the list, summary <= 120 characters, >= 1 ref. Dedupe by key returns the existing entry with `deduplicated: true`. The per-dispatch cap on `observation` applies per ticket.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-add.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/forbidden-field`, `policy/no-open-ticket`, `policy/observation-cap`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log add finding "expired magic link still accepted" --ref src/auth/login.ts --ref 02-3 --ticket A-7f3k --json
  ```

  ```json
  {
    "entry": {
      "id": "L-e8k2s",
      "type": "finding",
      "summary": "expired magic link still accepted",
      "status": "proposed",
      "source": "agent:implementer",
      "author": "Przemysław Broniszewski",
      "at": "2026-09-25T10:15:02Z",
      "refs": [
        "src/auth/login.ts",
        "02-3"
      ],
      "review": false
    },
    "path": ".bdk/changes/2026-09-25-passwordless-login/log/20260925T101502-finding-expired-magic-link.md",
    "deduplicated": false
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log add finding "expired magic link still accepted" --ref src/auth/login.ts --ref 02-3 --ticket A-7f3k --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-add.json`

#### Scenario: input/forbidden-field

- **WHEN** a kernel-stamped field (`id`, `at`, `author`, `source`) was passed as input (P1)
- **THEN** the exit code is 3 and the error object carries `rule: input/forbidden-field`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/observation-cap

- **WHEN** the per-dispatch cap on `observation` entries is reached (K2)
- **THEN** the exit code is 2 and the error object carries `rule: policy/observation-cap`

### Requirement: bdk log ingest

Ingest a `bdk-entries` block from a read-only role's report under its ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log ingest [--ticket <ticket>] [--file <path>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--ticket <ticket>`. Required; provenance comes from the ticket's role.
  - `--file <path>`. Read the block from a file instead of stdin (typically the report).
  - stdin: The fenced bdk-entries YAML block, or a whole report containing exactly one such block.
- **Behaviour:** Verifier, reviewer and reader roles end their report with a fenced `bdk-entries` YAML block; the orchestrator passes it here verbatim (T2). Every entry is validated exactly like `log add`; one bad entry refuses the whole block with `input/invalid-block` naming the line and field, and the orchestrator re-dispatches once before the block becomes a `blocker` entry (design edge case). A blocking item whose category is not in the closed list is downgraded (P8). The ticket's entry counter is what `attempt close` checks against the envelope.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-ingest.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/invalid-block`, `input/forbidden-field`, `policy/no-open-ticket`, `policy/observation-cap`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log ingest --ticket A-9c2d --file .bdk/changes/2026-09-25-passwordless-login/reports/plan-verifier-1.md --json
  ```

  ```json
  {
    "ticket": "A-9c2d",
    "entries": [
      {
        "id": "L-w4m1q",
        "type": "blocker",
        "summary": "plan claims verifyToken exists; it does not",
        "status": "proposed",
        "source": "agent:plan-verifier",
        "at": "2026-09-25T10:31:44Z",
        "refs": [
          "plan/parts/02-login.md",
          "src/auth/token.ts"
        ]
      }
    ],
    "downgraded": []
  }
  ```

- **Owner:** T22
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log ingest --ticket A-9c2d --file .bdk/changes/2026-09-25-passwordless-login/reports/plan-verifier-1.md --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-ingest.json`

#### Scenario: input/invalid-block

- **WHEN** the `bdk-entries` block does not parse or one entry fails validation
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-block`

#### Scenario: input/forbidden-field

- **WHEN** a kernel-stamped field (`id`, `at`, `author`, `source`) was passed as input (P1)
- **THEN** the exit code is 3 and the error object carries `rule: input/forbidden-field`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/observation-cap

- **WHEN** the per-dispatch cap on `observation` entries is reached (K2)
- **THEN** the exit code is 2 and the error object carries `rule: policy/observation-cap`

### Requirement: bdk log list

Ledger entries as summaries, filtered by type, status, review flag or reference. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log list [--type decision|finding|observation|blocker|question|assumption|risk|learning|report|transition] [--status proposed|accepted|superseded|resolved|routed] [--review] [--for <task|part|file>] [--all]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--type decision|finding|observation|blocker|question|assumption|risk|learning|report|transition`.
  - `--status proposed|accepted|superseded|resolved|routed`.
  - `--review`. Only review: true entries.
  - `--for <task|part|file>`.
  - `--all`.
- **Behaviour:** Summaries only; `< 200 ms` at 1 000 entries is the T20 target, met by the index. Timing telemetry lands in `.machine/` from day one.
- **Writes:** nothing
- **Output:** `schema/cli/output/log-list.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log list --type decision --status accepted --json
  ```

  ```json
  {
    "items": [
      {
        "id": "L-a2s5d",
        "type": "decision",
        "summary": "magic links, no passwords, WebAuthn later",
        "status": "accepted",
        "source": "user",
        "at": "2026-09-25T09:12:30Z",
        "refs": [
          "design.md"
        ]
      }
    ],
    "total": 1,
    "truncated": false
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log list --type decision --status accepted --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-list.json`

### Requirement: bdk log show

One entry in full, by bare or qualified id. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log show <id>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required). L-xxxx or <changeId>/L-xxxx.
- **Behaviour:** Available to subagents: a dispatch package carries summaries, and a worker fetches the full text of an entry it needs (K3).
- **Writes:** nothing
- **Output:** `schema/cli/output/log-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log show L-a2s5d --json
  ```

  ```json
  {
    "entry": {
      "id": "L-a2s5d",
      "type": "decision",
      "summary": "magic links, no passwords, WebAuthn later",
      "status": "accepted",
      "source": "user",
      "author": "Przemysław Broniszewski",
      "at": "2026-09-25T09:12:30Z",
      "refs": [
        "design.md"
      ],
      "body": "We ship magic links first ...",
      "path": ".bdk/changes/2026-09-25-passwordless-login/log/20260925T091230-decision-magic-links.md"
    }
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log show L-a2s5d --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-show.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk log resolve

Set an entry's status (resolved, accepted, superseded) with a reason. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log resolve <id> accepted|resolved|superseded [--by <id>] [--reason <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required).
  - `accepted|resolved|superseded` (required).
  - `--by <id>`. Superseding entry; required with superseded.
  - `--reason <text>`.
- **Behaviour:** Entries are append-only files: the status change is itself a record (T14 decides whether as a frontmatter rewrite guarded by the merge test or as a follow-up entry; the output names the record either way). `source: user` cannot be produced here.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-resolve.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log resolve L-e8k2s resolved --reason "fixed in A-7f3k retry" --json
  ```

  ```json
  {
    "entry": "L-e8k2s",
    "status": "resolved",
    "record": "L-o7p3x",
    "reason": "fixed in A-7f3k retry"
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log resolve L-e8k2s resolved --reason "fixed in A-7f3k retry" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-resolve.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

### Requirement: bdk log route

Route learning entries at close: rule proposal, spec, or nothing, by the T31 thresholds. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log route [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--dry-run`.
- **Behaviour:** Nothing under `.bdk/rules/` changes here: a proposal is a `learning` entry marked `status: routed` with the evidence; the user accepts with `rules add` (T02 decision R-3, Q-4). Called by `change close`.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-route.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log route --dry-run --json
  ```

  ```json
  {
    "proposedRules": [
      {
        "entry": "L-z1c4h",
        "fingerprint": "tests|scoped|missing-negative-case",
        "signals": {
          "recurrence": 3,
          "authors": 2,
          "cost": 2
        }
      }
    ],
    "spec": [],
    "nothing": [
      "L-q8n2m"
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log route --dry-run --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-route.json`
