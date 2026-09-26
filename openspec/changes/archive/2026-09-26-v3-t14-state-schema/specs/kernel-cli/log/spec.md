# Spec Delta

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
- **Behaviour:** Verifier, reviewer and reader roles end their report with a fenced `bdk-entries` YAML block; the orchestrator passes it here verbatim (T2). Every entry is validated exactly like `log add`; one bad entry refuses the whole block with `input/invalid-block` naming the line and field, and the orchestrator re-dispatches once before the block becomes a `blocker` entry (design edge case). A blocking item whose category is not in the closed list is downgraded (P8). The ticket's entry counter is what `attempt close` checks against the envelope. A whole report passed on stdin is first stored at the `report` path of the ticket's dispatch package, because a read-only role has no file tool and `execute` disallows `Write` (`kernel-state`, Write map); a report passed with `--file` is not copied.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/reports/`
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
- **Behaviour:** The status change rewrites the entry's frontmatter in place and appends the reason to its body, one of the mutations `kernel-state` allows (Derived state and mutation) and that its two-branch merge test covers. `superseded` is never stored: the kernel writes `supersedes: <id>` into the `--by` entry, and the status is derived from it. `record` names the rewritten entry: `<id>`, or the `--by` entry for `superseded`. `source: user` cannot be produced here.
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
    "record": "L-e8k2s",
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
