## MODIFIED Requirements

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
