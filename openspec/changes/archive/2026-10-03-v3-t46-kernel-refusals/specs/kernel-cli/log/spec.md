## MODIFIED Requirements

### Requirement: bdk log ingest

Store a role's report under its ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk log ingest --ticket <ticket>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--ticket <ticket>`. Required; the role and the report path come from the ticket's active package.
  - stdin: The report: a YAML frontmatter holding the envelope, then the Markdown body.
- **Behaviour:** Every role, the `implementer` included, stores its report here (T23-D14, `role-contracts`, Role contract content). The frontmatter holds the envelope fields the role writes: `status`, `files`, `entries`, `evidence` and, for `blocked` and `needs-context`, `reason` (`kernel-state`, Report envelope); a frontmatter carrying `schema`, `ticket` or `role` is `input/forbidden-field`, because the kernel stamps them from the ticket and its package. A missing frontmatter, an unknown field or a field failing the envelope schema is `input/invalid-envelope`, whose `why` names the field and its line. Every id in `entries` must be an entry whose `ticket` is this ticket (`policy/entries-missing` naming the others); every id in `evidence` must name a manifest recorded under the ticket (`policy/entries-missing` as well). `--ticket` must name an open ticket with a dispatch package (`policy/no-open-ticket`). On success the kernel writes the report to the active package's `report` path, so the reports of the ticket's other roles stay, frontmatter first in flow style so the envelope stays within 15 lines, and a later call under the same open ticket replaces it. A refused report writes nothing, so the agent fixes it and calls again before it returns. The command writes no ledger entry: entries come only from `log add` (T23-D14). An empty or null `reason` (`reason: ""`, `reason: null`) reads as an absent `reason` when `status` is `done` or `done-with-concerns`, and the stored report holds no `reason`; on `blocked` and `needs-context` it stays refused with `input/invalid-envelope` naming `reason`.
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

#### Scenario: each role of a ticket keeps its report

- **WHEN** the implementer of ticket `A-7f3k9m2q` stored its report, `dispatch build 02-3 runner A-7f3k9m2q` ran, and the runner pipes its report to `bdk log ingest --ticket A-7f3k9m2q`
- **THEN** the runner report is written at `reports/02-3-runner-A-7f3k9m2q.md` with `role: runner`, `replaced` is false, and the implementer report is unchanged

#### Scenario: empty reason on a status that needs none

- **WHEN** the envelope holds `status: done` or `status: done-with-concerns` and `reason: ""` or `reason: null`
- **THEN** the report is stored and its frontmatter has no `reason`

#### Scenario: empty reason on blocked

- **WHEN** the envelope holds `status: blocked` and `reason: ""`
- **THEN** it refuses with `input/invalid-envelope` naming `reason`
