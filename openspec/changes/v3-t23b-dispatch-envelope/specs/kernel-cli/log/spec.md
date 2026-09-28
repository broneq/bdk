## MODIFIED Requirements

### Requirement: bdk log add

Append one ledger entry; the kernel stamps id, time, author and source. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log add decision|finding|observation|blocker|question|assumption|risk|learning|report <summary> [--ref <ref>] [--body <text>] [--ticket <ticket>] [--category <id>] [--review] [--supersedes <id>] [--status proposed|accepted|superseded|resolved|routed]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `decision|finding|observation|blocker|question|assumption|risk|learning|report` (required).
  - `<summary>` (required). <= 120 characters.
  - `--ref <ref>`. Repeatable; at least one (file, symbol, part, task, rule or entry id).
  - `--body <text>`. Markdown body; - reads it from stdin.
  - `--ticket <ticket>`. The ticket the caller works under; required inside a dispatch, sets source: agent:<role>.
  - `--category <id>`. The entry's category; a verifier blocker needs one from policy.verifier.blocking-categories (P8).
  - `--review`. Mark the entry to be shown at the next gate.
  - `--supersedes <id>`.
  - `--status proposed|accepted|superseded|resolved|routed`.
  - stdin: Body text when --body - is given.
- **Behaviour:** Available to subagents: every role writes its own entries (T23-D14). `type: transition` is not accepted here and `--source` does not exist: `source` is `agent:<role>` when `--ticket` names an open ticket whose dispatch package names the role, and `kernel` for the main thread without a ticket; passing `id`, `at`, `author`, `source` or `fingerprint` as a flag in any form is `input/forbidden-field` (P1, T20 acceptance: `--source user` exits 3). A ticket without an open attempt record or without a dispatch package is `policy/no-open-ticket`. Validation: type from the list, summary 1-120 characters, >= 1 ref, the T14 entry schema; `--status` defaults to `proposed`, `superseded` is refused (`input/invalid-argument`, it is derived from `--supersedes`) and so is `routed` (only `log route` sets it). `--supersedes` must name an existing entry (`input/not-found`). A `blocker` under a ticket whose package role is `verifier` or `design-verifier` and whose `--category` is missing or not an `id` of the resolved `policy.verifier.blocking-categories` is written as an `observation` with `review: true`, the given category kept, and a body that starts with `Downgraded from blocker: category <id|none> is not a blocking category (P8).` followed by the given body; the output's `downgraded` names the original type and category (P8). Nothing caps the number of entries per ticket (T23-D13). The kernel stamps `id` (retrying when the id exists in the Change), `at` from its clock, `author` from git (`user.name <user.email>`), `source`, `ticket` and, for `learning`, `fingerprint`, and writes `log/<ts>-<type>-<id>.md`. Dedupe by key (`kernel-state`, Ledger deduplication) returns the existing entry with `deduplicated: true` and writes nothing.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/log-add.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/forbidden-field`, `input/not-found`, `policy/no-open-ticket`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

- **WHEN** a ticket already holds five `observation` entries and a sixth is added
- **THEN** the exit code is 0: the per-dispatch cap and its rule are gone (T23-D13)

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

#### Scenario: verifier blocker without a category

- **WHEN** under a `verifier` ticket `bdk log add blocker "naming is inconsistent" --ref 02-3 --ticket A-9c2d4f6h` runs without `--category`
- **THEN** the exit code is 0, the entry is an `observation` with `review: true` whose body starts with `Downgraded from blocker: category none`, and `downgraded` is `{type: blocker, category: null}`

#### Scenario: verifier blocker in a blocking category

- **WHEN** under a `verifier` ticket the same command runs with `--category false-code-claim`
- **THEN** the entry is a `blocker` with `category: false-code-claim` and `downgraded` is absent

#### Scenario: implementer blocker is never downgraded

- **WHEN** under an `implementer` ticket `bdk log add blocker "stop-rule fired" --ref 02-3 --ticket A-7f3k9m2q` runs without `--category`
- **THEN** the entry is a `blocker`

### Requirement: bdk log ingest

Store a role's report under its ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log ingest --ticket <ticket>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--ticket <ticket>`. Required; the role and the report path come from the ticket's dispatch package.
  - stdin: The report: a YAML frontmatter holding the envelope, then the Markdown body.
- **Behaviour:** Every role, the `implementer` included, stores its report here (T23-D14, `role-contracts`, Role contract content). The frontmatter holds the envelope fields the role writes: `status`, `files`, `entries`, `evidence` and, for `blocked` and `needs-context`, `reason` (`kernel-state`, Report envelope); a frontmatter carrying `schema`, `ticket` or `role` is `input/forbidden-field`, because the kernel stamps them from the ticket and its package. A missing frontmatter, an unknown field or a field failing the envelope schema is `input/invalid-envelope`, whose `why` names the field and its line. Every id in `entries` must be an entry whose `ticket` is this ticket (`policy/entries-missing` naming the others); every id in `evidence` must name a manifest recorded under the ticket (`policy/entries-missing` as well). `--ticket` must name an open ticket with a dispatch package (`policy/no-open-ticket`). On success the kernel writes the report to the package's `report` path, frontmatter first in flow style so the envelope stays within 15 lines, and a later call under the same open ticket replaces it. A refused report writes nothing, so the agent fixes it and calls again before it returns. The command writes no ledger entry: entries come only from `log add` (T23-D14).
- **Writes:** `.bdk/changes/<id>/reports/`
- **Output:** `schema/cli/output/log-ingest.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/invalid-envelope`, `input/forbidden-field`, `policy/no-open-ticket`, `policy/entries-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk log ingest --ticket A-9c2d4f6h --json < report.md
  ```

  ```json
  {
    "ticket": "A-9c2d4f6h",
    "role": "verifier",
    "path": ".bdk/changes/2026-09-25-passwordless-login/reports/02-verifier-A-9c2d4f6h.md",
    "status": "done-with-concerns",
    "entries": [
      "L-w4m1q7ra"
    ],
    "replaced": false
  }
  ```

- **Owner:** T23
- **Slice:** `log`

#### Scenario: example run

- **WHEN** `bdk log ingest --ticket A-9c2d4f6h --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/log-ingest.json`

#### Scenario: input/invalid-envelope

- **WHEN** the report piped to `bdk log ingest --ticket A-9c2d4f6h` has no frontmatter, or its frontmatter carries the unknown field `verdict`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-envelope` naming the missing frontmatter or the field, and nothing is written under `reports/`

#### Scenario: policy/entries-missing

- **WHEN** the envelope's `entries` lists an id written under another ticket, or its `evidence` lists a manifest id not recorded under this ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/entries-missing` naming the ids, and nothing is written under `reports/`

#### Scenario: input/invalid-block

- **WHEN** the report's frontmatter has `status: blocked` and no `reason`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-envelope` naming `reason`, and nothing is written under `reports/`

#### Scenario: input/forbidden-field

- **WHEN** the report's frontmatter carries `ticket` or `role` (P1)
- **THEN** the exit code is 3 and the error object carries `rule: input/forbidden-field`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed or has no dispatch package
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/observation-cap

- **WHEN** the envelope lists six `observation` entries written under the ticket
- **THEN** the exit code is 0: no cap applies (T23-D13)

#### Scenario: wrong type names the line

- **WHEN** the frontmatter's third line is `status: finished`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-envelope`, and `why` names `status` and line 3

#### Scenario: counter checked at close

- **WHEN** the envelope lists two ids written under ticket `A-9c2d4f6h` and a third that does not exist
- **THEN** `log ingest` exits 2 with `rule: policy/entries-missing` naming the third id and writes nothing, and `attempt close` applies the same check to a report that reached `reports/` another way

#### Scenario: implementer stores its report

- **WHEN** an `implementer` pipes a valid report to `bdk log ingest --ticket A-7f3k9m2q`
- **THEN** the report is written at the package's `report` path with `schema`, `ticket: A-7f3k9m2q` and `role: implementer` stamped, and a second call replaces it with `replaced: true`
