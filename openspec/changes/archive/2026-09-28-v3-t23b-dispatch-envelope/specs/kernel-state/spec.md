## MODIFIED Requirements

### Requirement: Dispatch package

A dispatch package SHALL be written only by `dispatch build`, with the frontmatter fields below (K3, K4, P10) and the body sections that `kernel-cli/dispatch`, `bdk dispatch build`, lists in order; the whole file is at most 12 288 bytes.

| Field            | Type                        | Req. | Stamped | Meaning                                                     |
| ---------------- | --------------------------- | ---- | ------- | ----------------------------------------------------------- |
| `schema`         | integer                     | yes  | kernel  |                                                             |
| `ticket`         | `A-` id                     | yes  | kernel  |                                                             |
| `target`         | string                      | yes  | kernel  |                                                             |
| `role`           | string                      | yes  | kernel  | Role skill name (`implementer`, `verifier`, ...).           |
| `adapter`        | string                      | yes  | kernel  | The role's adapter (`role-contracts`, Role-to-adapter map). |
| `attempt`        | integer >= 1                | yes  | kernel  |                                                             |
| `of`             | integer >= 1                | yes  | kernel  |                                                             |
| `scope`          | `full \| high+ \| blockers` | yes  | kernel  |                                                             |
| `at`             | timestamp                   | yes  | kernel  |                                                             |
| `kernel-version` | string                      | yes  | kernel  | P10.                                                        |
| `template-hash`  | hash                        | yes  | kernel  | P10.                                                        |
| `report`         | path                        | yes  | kernel  | Where the role's report is written (`reports/...`).         |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

#### Scenario: package with an unknown adapter

- **WHEN** a dispatch package carries `adapter: planner`
- **THEN** validation fails naming `adapter`

### Requirement: Report envelope

A report's frontmatter SHALL be the role's envelope (at most 15 rendered lines) and its body SHALL be the full report. `log ingest` writes every report, stamping `schema`, `ticket` and `role`; a role writes only the other fields and never a `bdk-entries` block (T23-D14).

| Field      | Type                                                     | Req. | Meaning                                                 |
| ---------- | -------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `schema`   | integer                                                  | yes  | Stamped by `log ingest`.                                |
| `ticket`   | `A-` id                                                  | yes  | Stamped by `log ingest` from `--ticket`.                |
| `role`     | string                                                   | yes  | Stamped by `log ingest` from the dispatch package.      |
| `status`   | `done \| done-with-concerns \| needs-context \| blocked` | yes  | The four statuses of the v2 return contract.            |
| `files`    | array of paths                                           | yes  | Files the role changed; empty for read-only roles.      |
| `entries`  | array of `L-` ids                                        | yes  | Entries the role wrote with `log add`; empty when none. |
| `evidence` | array of `E-` ids                                        | yes  | Manifests the role recorded; empty when none.           |
| `reason`   | string                                                   | no   | Required for `blocked` and `needs-context`.             |

#### Scenario: blocked without reason

- **WHEN** a report has `status: blocked` and no `reason`
- **THEN** validation fails naming `reason`

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `rules-read` by the first `rules show --ticket` call and completed by `attempt close`, with these fields.

| Field           | Type                                                      | Req. | Stamped | Meaning                                                                                       |
| --------------- | --------------------------------------------------------- | ---- | ------- | --------------------------------------------------------------------------------------------- |
| `schema`        | integer                                                   | yes  | kernel  |                                                                                               |
| `ticket`        | `A-` id                                                   | yes  | kernel  |                                                                                               |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).               |
| `target`        | string                                                    | yes  |         | Task, part, artifact or Change id.                                                            |
| `attempt`       | integer >= 1                                              | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                 |
| `of`            | integer >= 1                                              | yes  | kernel  | Budget from policy.                                                                           |
| `scope`         | `full \| high+ \| blockers`                               | yes  |         |                                                                                               |
| `narrowed-from` | `full \| high+ \| blockers`                               | no   |         |                                                                                               |
| `escalation`    | boolean                                                   | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`. |
| `opened-at`     | timestamp                                                 | yes  | kernel  |                                                                                               |
| `author`        | string                                                    | yes  | kernel  |                                                                                               |
| `closed-at`     | timestamp                                                 | no   | kernel  | Present exactly when `outcome` is.                                                            |
| `outcome`       | `ok \| fail \| not-run`                                   | no   |         |                                                                                               |
| `findings`      | array of `{fingerprint, type, file, symbol?}`             | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).          |
| `dropped`       | array of `L-` ids                                         | no   |         | Findings that fell out of scope N+1.                                                          |
| `rules-read`    | timestamp                                                 | no   | kernel  | First `rules show --ticket` call for the ticket (risk R2); read by `attempt close`.           |

The body is the close reason (`--reason` of `attempt close`, `taken over` from `change takeover`). `not-run` counters and budgets are derived from the records of a loop, target and round (`kernel-loops`, Loops, targets and rounds), never stored.

#### Scenario: closed without timestamp

- **WHEN** an attempt record has `outcome` but no `closed-at`
- **THEN** validation fails naming `closed-at`

#### Scenario: escalation loop name is gone

- **WHEN** an attempt record carries `loop: task-escalation`
- **THEN** reading the Change reports `state/ledger-invalid` naming `loop`

#### Scenario: rules-read survives a rebuild

- **WHEN** a ticket's record carries `rules-read` and `bdk rebuild` recreates the index
- **THEN** `attempt close` still finds the ticket's rules read

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                           | Writers                                                                                                                       | Channel                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `change.md`                    | `change new`; `import` (each v2 design becomes a Change with `source: inferred`, through the code of `change new --inferred`) | kernel                  |
| `log/`                         | the commands of the entry-type table                                                                                          | kernel                  |
| `design.md`, `architecture.md` | `design` skill                                                                                                                | host file tools         |
| `design/parts/`                | `design` skill                                                                                                                | host file tools         |
| `design/index.md`              | `done`, `rebuild`, `change takeover`                                                                                          | kernel                  |
| `plan/parts/`                  | `plan` skill; `part split`                                                                                                    | host file tools; kernel |
| `plan/index.md`                | `done`, `part split`, `rebuild`, `change takeover`                                                                            | kernel                  |
| `spec-delta/`                  | `design` and `plan` skills                                                                                                    | host file tools         |
| `attempts/`                    | `attempt open`, `attempt close`, `change takeover`; `rules show --ticket` (the `rules-read` stamp)                            | kernel                  |
| `evidence/`                    | `evidence record`                                                                                                             | kernel                  |
| `dispatch/`                    | `dispatch build`                                                                                                              | kernel                  |
| `reports/`                     | `log ingest` (the report of every role, on stdin, at the package's `report` path)                                             | kernel                  |
| any file (migration)           | `rebuild`, `change takeover`                                                                                                  | kernel                  |
| the Change directory (archive) | `change close`                                                                                                                | kernel                  |
| `.bdk/rules/<ruleId>.md`       | `rules add --accept`, `rules import`, `import`                                                                                | kernel                  |

Entry types (`source` values each writer stamps):

| Type          | Writers and `source`                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `log add` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split`, `done` for the profile raise of a split design (`kernel`)                                                               |
| `finding`     | `log add`; `attempt close` and `commit` for undeclared files, `attempt close` for an implementer that read no rules, `attempt open` for dropped findings, `commit` and `part done` for the tiny guard (`kernel`)                    |
| `observation` | `log add` (including a downgraded uncategorised verifier blocker, P8)                                                                                                                                                               |
| `blocker`     | `log add`                                                                                                                                                                                                                           |
| `question`    | `log add`; `change park` and `attempt close` at the end of the ladder (`kernel`, with `park: true`)                                                                                                                                 |
| `assumption`  | `log add`; `change new` for the proposed profile (`kernel`)                                                                                                                                                                         |
| `risk`        | `log add`                                                                                                                                                                                                                           |
| `learning`    | `log add`, `rules add` (`agent:<role>` or `kernel`); status by `log route`                                                                                                                                                          |
| `report`      | `log add`                                                                                                                                                                                                                           |
| `transition`  | `hooks prompt-expansion` (`user` for a typed stage command, `policy` for an auto gate, `kernel` for a stage without a gate); `done`, `part start` (without `input-hash`), `part done`, `change takeover`, `change close` (`kernel`) |

Rules without exception: `intent` lives only in `change.md`, written only by `change new` (which `import` reuses); a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `log add` never writes `transition`, `log ingest` writes no entry at all, and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

#### Scenario: every file has a writer

- **WHEN** the write map contract test walks the layout table and the ten entry types
- **THEN** each has at least one writer in the tables above

#### Scenario: log add cannot write a transition

- **WHEN** `log add` is called with `type: transition`
- **THEN** the exit code is 3 and no file is written

#### Scenario: ladder writers are mapped

- **WHEN** the write map contract test reads the records of `attempt open`, `attempt close`, `part done` and `change takeover`
- **THEN** every Change path in their `writes[]` appears in the file table naming them

### Requirement: Write map enforcement

The kernel SHALL enforce the write map for every file a kernel command writes, and contract tests SHALL enforce the map against the CLI contract; files written through host file tools SHALL be validated at `done`.

Kernel-enforced: only `shared/store` builds Change paths and writes them; schema validation on write and read; kernel-stamped fields are never taken from input (`input/forbidden-field`); availability classes keep subagents off orchestrator commands (`hooks pre-tool`, T24). Contract-enforced: every kernel writer in the tables is a command of `schema/cli/commands.json` whose availability is `orchestrator`, `agent` or `hook` (never `read`) and whose `writes[]` covers the path; every Change path in any command's `writes[]` appears in the file table. Documented and validated at `done`: files written through host file tools (design and plan artifacts, `spec-delta/`); the kernel cannot see their writer, and whether `hooks pre-tool` denies host-tool writes into kernel-channel paths is T24's decision.

#### Scenario: writer is a read command

- **WHEN** the file table names a command whose availability is `read`
- **THEN** the write map contract test fails naming the command

#### Scenario: undeclared write

- **WHEN** a command's `writes[]` lists a Change path that the file table does not name it for
- **THEN** the write map contract test fails naming the command and the path
