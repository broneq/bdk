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
- **Behaviour:** Available to subagents (worker and runner roles write their own entries, T2). `type: transition` is not accepted here and `--source` does not exist: `source` is `agent:<role>` when `--ticket` names an open ticket whose dispatch package names the role, and `kernel` for the main thread without a ticket; passing `id`, `at`, `author`, `source` or `fingerprint` as a flag in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). A ticket without an open attempt record or without a dispatch package is `policy/no-open-ticket`. Validation: type from the list, summary 1-120 characters, >= 1 ref, the T14 entry schema; `--status` defaults to `proposed`, `superseded` is refused (`input/invalid-argument`, it is derived from `--supersedes`) and so is `routed` (only `log route` sets it). `--supersedes` must name an existing entry (`input/not-found`). The kernel stamps `id` (retrying when the id exists in the Change), `at` from its clock, `author` from git (`user.name <user.email>`), `source`, `ticket` and, for `learning`, `fingerprint`, and writes `log/<ts>-<type>-<id>.md`. Dedupe by key (`kernel-state`, Ledger deduplication) returns the existing entry with `deduplicated: true` and writes nothing. The per-dispatch cap on `observation` applies per ticket and is enforced from T23.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-add.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/forbidden-field`, `input/not-found`, `policy/no-open-ticket`, `policy/observation-cap`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log add finding "expired magic link still accepted" --ref src/auth/login.ts --ref 02-3 --ticket A-7f3k9m2q --json
  ```

  ```json
  {
    "entry": {
      "id": "L-e8k2s5vw",
      "type": "finding",
      "summary": "expired magic link still accepted",
      "status": "proposed",
      "source": "agent:implementer",
      "author": "Przemysław Broniszewski <przemek@example.com>",
      "at": "2026-09-25T10:15:02Z",
      "refs": [
        "src/auth/login.ts",
        "02-3"
      ],
      "review": false
    },
    "path": ".bdk/changes/2026-09-25-add-passwordless-login/log/20260925T101502Z-finding-L-e8k2s5vw.md",
    "deduplicated": false
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log add finding "expired magic link still accepted" --ref src/auth/login.ts --ref 02-3 --ticket A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-add.json`

#### Scenario: input/forbidden-field

- **WHEN** a kernel-stamped field (`id`, `at`, `author`, `source`) was passed as input (P1)
- **THEN** the exit code is 3 and the error object carries `rule: input/forbidden-field`

#### Scenario: input/not-found

- **WHEN** `--supersedes` names an entry that does not exist
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/observation-cap

- **WHEN** the per-dispatch cap on `observation` entries is reached (K2)
- **THEN** the exit code is 2 and the error object carries `rule: policy/observation-cap`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: source user is unreachable

- **WHEN** `bdk log add decision "approved" --ref design.md --source user` runs
- **THEN** the exit code is 3 with `rule: input/forbidden-field` and no file is written under `log/`

#### Scenario: fifteen parallel writers

- **WHEN** fifteen `bdk log add` processes with different summaries run at the same time in one Change
- **THEN** all fifteen exit 0, `log/` holds fifteen new files with fifteen distinct ids, and no lock or marker file exists

#### Scenario: deduplicated entry

- **WHEN** `bdk log add` repeats the type, summary (up to case, punctuation and digits) and refs of a `proposed` entry
- **THEN** the exit code is 0, `deduplicated` is `true`, `entry.id` is the existing id and no file is written

### Requirement: bdk log ingest

Ingest a `bdk-entries` block from a read-only role's report under its ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log ingest [--ticket <ticket>] [--file <path>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--ticket <ticket>`. Required; provenance comes from the ticket's role.
  - `--file <path>`. Read the block from a file instead of stdin (typically the report).
  - stdin: The fenced bdk-entries YAML block, or a whole report containing exactly one such block.
- **Behaviour:** Verifier, reviewer and reader roles end their report with a fenced `bdk-entries` YAML block; the orchestrator passes it here verbatim (T2). The input holds exactly one fenced block whose info string is `bdk-entries`; none, two, or a block that is not a YAML sequence of mappings is `input/invalid-block`. Each item takes the fields of `log add` in their document spelling: `type` (not `transition`), `summary`, `refs`, and optionally `body`, `review`, `supersedes`, `status`, `severity`, `category`, `options`; an item carrying `id`, `at`, `author`, `source`, `ticket` or `fingerprint` is `input/forbidden-field` naming the item's line. Every item is validated exactly like `log add` (the T14 entry schema, `supersedes` naming an existing entry) before any is written; the first invalid item refuses the whole block with `input/invalid-block` whose `why` names the item's position, the field and the line number in the input (a line of the whole report when a report is given), and nothing is written. `--ticket` must name an open ticket whose dispatch package names the role (`policy/no-open-ticket` otherwise); every entry is stamped `source: agent:<role>`, `ticket`, `id`, `at` and `author`, and deduplicated like `log add`. The entries carrying the ticket are its entry counter, which `attempt close --envelope` checks against the envelope. A whole report passed on stdin is first stored at the `report` path of the ticket's dispatch package, because a read-only role has no file tool and `execute` disallows `Write` (`kernel-state`, Write map); a report passed with `--file` is not copied. The P8 downgrade of a blocking item whose category is not in the closed list and the per-dispatch `observation` cap apply from T23; until then `downgraded` is empty.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/reports/`
- **Output:** `schema/cli/output/log-ingest.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/invalid-block`, `input/forbidden-field`, `policy/no-open-ticket`, `policy/observation-cap`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log ingest --ticket A-9c2d4f6h --file .bdk/changes/2026-09-25-passwordless-login/reports/plan-verify-plan-verifier-A-9c2d4f6h.md --json
  ```

  ```json
  {
    "ticket": "A-9c2d4f6h",
    "entries": [
      {
        "id": "L-w4m1q7ra",
        "type": "blocker",
        "summary": "plan claims verifyToken exists; it does not",
        "status": "proposed",
        "source": "agent:plan-verifier",
        "author": "Jan Kowalski <jan@example.com>",
        "at": "2026-09-25T10:31:44Z",
        "refs": [
          "plan/parts/02-login.md",
          "src/auth/token.ts"
        ],
        "review": false,
        "ticket": "A-9c2d4f6h"
      }
    ],
    "downgraded": []
  }
  ```

- **Owner:** T22
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log ingest --ticket A-9c2d4f6h --file .bdk/changes/2026-09-25-passwordless-login/reports/plan-verify-plan-verifier-A-9c2d4f6h.md --json` runs as in the example
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

- **WHEN** the per-dispatch cap on `observation` entries is reached (K2; emitted from T23)
- **THEN** the exit code is 2 and the error object carries `rule: policy/observation-cap`

#### Scenario: wrong type names the line

- **WHEN** a report whose `bdk-entries` block starts on line 40 holds three items and the second, on line 45, has `type: bug`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-block`, `why` names item 2, the field `type` and line 45, and no entry of the block is written

#### Scenario: counter checked at close

- **WHEN** `log ingest` wrote two entries under ticket `A-9c2d4f6h` and the envelope passed to `attempt close A-9c2d4f6h ok --envelope <path>` lists those two ids and a third that does not exist
- **THEN** `attempt close` exits 2 with `rule: policy/entries-missing` naming the third id

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
- **Behaviour:** Summaries only, read from the index, ordered by `at` then id. `status` is the derived status (`superseded` when another entry names the entry in `supersedes`). `--for` keeps entries with a ref equal to the value, a task ref of the part (`02` matches `02-3`) or a symbol ref of the file (`src/a.ts` matches `src/a.ts#login`). `< 200 ms` at 1 000 entries is the T20 target, met by the index. Every run appends one line (`at`, duration in milliseconds, entry count, whether the index was refreshed) to `.bdk/.machine/telemetry/log-list.jsonl`, kept below 256 KB by dropping the oldest half.
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
        "id": "L-a2s5d8fg",
        "type": "decision",
        "summary": "magic links, no passwords, WebAuthn later",
        "status": "accepted",
        "source": "kernel",
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

#### Scenario: 1 000 entries under 200 ms

- **WHEN** `bdk log list --json` runs twice on a Change with 1 000 entries and the second run finds the index fresh
- **THEN** the second run takes less than 200 ms end to end and its telemetry line records the duration

### Requirement: bdk log show

One entry in full, by bare or qualified id. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log show <id>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<id>` (required). L-xxxx or <changeId>/L-xxxx.
- **Behaviour:** Available to subagents: a dispatch package carries summaries, and a worker fetches the full text of an entry it needs (K3). A qualified id reads the named Change, archived or not; a malformed id is `input/invalid-argument`. `supersededBy` names the entry that supersedes this one.
- **Writes:** nothing
- **Output:** `schema/cli/output/log-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log show L-a2s5d8fg --json
  ```

  ```json
  {
    "entry": {
      "id": "L-a2s5d8fg",
      "type": "decision",
      "summary": "magic links, no passwords, WebAuthn later",
      "status": "accepted",
      "source": "kernel",
      "author": "Przemysław Broniszewski <przemek@example.com>",
      "at": "2026-09-25T09:12:30Z",
      "refs": [
        "design.md"
      ],
      "body": "We ship magic links first ...",
      "path": ".bdk/changes/2026-09-25-add-passwordless-login/log/20260925T091230Z-decision-L-a2s5d8fg.md"
    }
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log show L-a2s5d8fg --json` runs as in the example
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
- **Behaviour:** The status change rewrites the entry's frontmatter in place and appends the reason to its body (a line `Resolved as <status> at <at>: <reason>`), one of the mutations `kernel-state` allows (Derived state and mutation) and that its two-branch merge test covers. Allowed moves: `proposed` to `accepted` or `resolved`, `accepted` to `resolved`, and `superseded` from `proposed` or `accepted`; every other move, a repeated one, a `transition` entry and a `routed` or already superseded entry are `policy/invalid-transition` naming the current status. `superseded` is never stored: the kernel writes `supersedes: <id>` into the `--by` entry (missing `--by` is `input/missing-argument`; a `--by` entry that already supersedes another is `policy/invalid-transition`), and the status is derived from it. `record` names the rewritten entry: `<id>`, or the `--by` entry for `superseded`. `source: user` cannot be produced here.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-resolve.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log resolve L-e8k2s5vw resolved --reason "fixed in A-7f3k9m2q retry" --json
  ```

  ```json
  {
    "entry": "L-e8k2s5vw",
    "status": "resolved",
    "record": "L-e8k2s5vw",
    "reason": "fixed in A-7f3k9m2q retry"
  }
  ```

- **Owner:** T20
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log resolve L-e8k2s5vw resolved --reason "fixed in A-7f3k9m2q retry" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-resolve.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: superseded is derived

- **WHEN** `bdk log resolve L-aaaaaaaa superseded --by L-bbbbbbbb` runs
- **THEN** `L-bbbbbbbb`'s file gains `supersedes: L-aaaaaaaa`, `L-aaaaaaaa`'s file is unchanged, and `log list` shows `L-aaaaaaaa` as `superseded`

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
