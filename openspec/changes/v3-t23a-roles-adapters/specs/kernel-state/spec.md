## MODIFIED Requirements

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
| `attempts/`                    | `attempt open`, `attempt close`, `change takeover`                                                                            | kernel                  |
| `evidence/`                    | `evidence record`                                                                                                             | kernel                  |
| `dispatch/`                    | `dispatch build`                                                                                                              | kernel                  |
| `reports/`                     | the `implementer` role at the package's `report` path; `log ingest` (the report of every other role, on stdin)                | host file tools; kernel |
| any file (migration)           | `rebuild`, `change takeover`                                                                                                  | kernel                  |
| the Change directory (archive) | `change close`                                                                                                                | kernel                  |
| `.bdk/rules/<ruleId>.md`       | `rules add --accept`, `rules import`, `import`                                                                                | kernel                  |

Entry types (`source` values each writer stamps):

| Type          | Writers and `source`                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `log add`, `log ingest` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split`, `done` for the profile raise of a split design (`kernel`)                                                 |
| `finding`     | `log add`, `log ingest`; `attempt close` and `commit` for undeclared files, `attempt open` for dropped findings, `commit` and `part done` for the tiny guard (`kernel`)                                                             |
| `observation` | `log add`, `log ingest` (including a downgraded uncategorised blocker, P8)                                                                                                                                                          |
| `blocker`     | `log add`, `log ingest`                                                                                                                                                                                                             |
| `question`    | `log add`, `log ingest`; `change park` and `attempt close` at the end of the ladder (`kernel`, with `park: true`)                                                                                                                   |
| `assumption`  | `log add`, `log ingest`; `change new` for the proposed profile (`kernel`)                                                                                                                                                           |
| `risk`        | `log add`, `log ingest`                                                                                                                                                                                                             |
| `learning`    | `log add`, `log ingest`, `rules add` (`agent:<role>` or `kernel`); status by `log route`                                                                                                                                            |
| `report`      | `log add`, `log ingest`                                                                                                                                                                                                             |
| `transition`  | `hooks prompt-expansion` (`user` for a typed stage command, `policy` for an auto gate, `kernel` for a stage without a gate); `done`, `part start` (without `input-hash`), `part done`, `change takeover`, `change close` (`kernel`) |

Rules without exception: `intent` lives only in `change.md`, written only by `change new` (which `import` reuses); a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `log add` and `log ingest` never write `transition` and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

#### Scenario: every file has a writer

- **WHEN** the write map contract test walks the layout table and the ten entry types
- **THEN** each has at least one writer in the tables above

#### Scenario: log add cannot write a transition

- **WHEN** `log add` is called with `type: transition`
- **THEN** the exit code is 3 and no file is written

#### Scenario: ladder writers are mapped

- **WHEN** the write map contract test reads the records of `attempt open`, `attempt close`, `part done` and `change takeover`
- **THEN** every Change path in their `writes[]` appears in the file table naming them
