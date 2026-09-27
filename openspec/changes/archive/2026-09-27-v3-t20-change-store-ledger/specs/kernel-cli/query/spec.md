# Spec Delta

## MODIFIED Requirements

### Requirement: bdk query

Read-only SQL over the rebuildable index. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk query <sql> [--all]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<sql>` (required). A single SELECT over the public tables of the index.
  - `--all`. Lift the 100-row page.
- **Behaviour:** The index is a cache (R-store): a query never sees more than the committed files contain, and every Change of the project, archived ones included, is refreshed lazily before the query runs. The public tables are `changes`, `entries`, `refs`, `attempts` and `dispatches` (`kernel-state`, Rebuildable index); there is no table allowlist, but tables whose name starts with `_` are internal and may change in any release. The statement runs with the index in query-only mode, so it cannot write; anything but one statement starting with `SELECT` or `WITH` is `input/invalid-argument`, and so is a statement SQLite rejects (the message names SQLite's reason). Rows are arrays in column order; `columns` names them. The future global-findings extension builds on this command.
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

#### Scenario: writing statement

- **WHEN** `bdk query "delete from entries"` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` and the index is unchanged
