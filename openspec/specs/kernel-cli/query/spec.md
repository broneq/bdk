# kernel-cli/query Specification

## Purpose

Index queries (`query`). Read-only SQL over the rebuildable index (R-store).

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/invalid-argument",
  "why": "only a single SELECT is accepted; the statement starts with DELETE",
  "instead": [
    "bdk query \"select ...\"",
    "bdk log resolve <id> <status> to change an entry"
  ]
}
```

## Requirements

### Requirement: bdk query

Read-only SQL over the rebuildable index. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk query <sql> [--all]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<sql>` (required). A single SELECT; T20 decides the table allowlist.
  - `--all`. Lift the 100-row page.
- **Behaviour:** The index is a cache (R-store): a query never sees more than the committed files contain, and a stale index is rebuilt lazily before the query runs. Anything but a SELECT is `input/invalid-argument`. The future global-findings extension builds on this command.
- **Writes:** nothing
- **Output:** `schema/cli/output/query.json`
- **Exit codes and rules:** `0, 3, 4, 5`. Specific rules: `state/corrupted-index`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk query "select type, count(*) from entries group by type" --json
  ```

  ```json
  {
    "columns": [
      "type",
      "count(*)"
    ],
    "items": [
      [
        "decision",
        4
      ],
      [
        "finding",
        7
      ]
    ],
    "total": 2,
    "truncated": false
  }
  ```

- **Owner:** T20
- **Slice:** `query`

#### Scenario: example run

- **WHEN** `bdk query "select type, count(*) from entries group by type" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/query.json`

#### Scenario: state/corrupted-index

- **WHEN** the SQLite index cannot be opened or disagrees with the files after a lazy rebuild
- **THEN** the exit code is 4 and the error object carries `rule: state/corrupted-index`
