# kernel-state delta

## MODIFIED Requirements

### Requirement: Change directory layout

A Change SHALL live in `.bdk/changes/<changeId>/` with exactly the paths below; every per-object file name SHALL carry the object's id or ticket so that two branches never create the same path.

The Change id is `<yyyy-mm-dd>-<slug>`: the kernel clock's UTC date at `change new` and a kebab-case slug of the intent (at most 40 characters). `change new` refuses when the directory exists.

| Path                                      | Document          | Committed | Note                                                                                                |
| ----------------------------------------- | ----------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `change.md`                               | change            | yes       | Written once.                                                                                       |
| `log/<ts>-<type>-<id>.md`                 | entry             | yes       | One file per ledger entry (K4); `<ts>` is `at` as `yyyymmddThhmmssZ`.                               |
| `design.md`                               | design artifact   | yes       | Profiles without design parts.                                                                      |
| `architecture.md`                         | design artifact   | yes       | T02 decision R-5.                                                                                   |
| `design/parts/<nn>-<slug>.md`             | design part       | yes       | `large` profile (R-4).                                                                              |
| `design/index.md`                         | design index      | yes       | Generated from the design parts.                                                                    |
| `plan/parts/<nn>-<slug>.md`               | plan part         | yes       |                                                                                                     |
| `plan/index.md`                           | plan index        | yes       | Generated from the plan parts.                                                                      |
| `spec-delta/<capability>.md`              | spec delta        | yes       | OpenSpec delta format (T30); carries no `schema` field and has no file in `schema/state/`.          |
| `attempts/<loop>-<target>-<ticket>.md`    | attempt           | yes       | One file per ticket (replaces the design's append-only `<loop>-<target>.md`).                       |
| `evidence/<target>-<evidenceId>.md`       | evidence manifest | yes       | Captures above `policy.evidence.max-committed-bytes` or not text live in `.bdk/.machine/evidence/`. |
| `evidence/<target>-<evidenceId>-<name>`   | evidence capture  | yes       | A file its manifest lists with `stored: committed`, under its own file name; not schema-checked.    |
| `dispatch/<target>-<role>-<ticket>.md`    | dispatch package  | yes       | The design's attempt number `<n>` becomes the ticket.                                               |
| `reports/<target>-<role>-<ticket>.md`     | report            | yes       |                                                                                                     |
| `dispatch/pruned.md`, `reports/pruned.md` | pruned index      | yes       | Archived Change only: replaces the directory's other files (Pruned index).                          |

`<target>` is a task id (`02-3`), a part id (`02`), an artifact id or the Change id, the same value as the attempt's `target`. Rule files live outside the Change as `.bdk/rules/<ruleId>.md` (T02 decision Q-5). Nothing else is created in a Change directory; `change close` moves it to `.bdk/changes/archive/` (T30).

#### Scenario: parallel creation never shares a path

- **WHEN** two branches each create an entry, an attempt, an evidence manifest, a dispatch package and a report for the same task of the same Change
- **THEN** the ten file paths are pairwise distinct

#### Scenario: unknown file in a Change

- **WHEN** a Change directory holds a file whose path matches no row of the layout table
- **THEN** reading the Change fails with `state/ledger-invalid` naming the path

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `package` by every `dispatch build` and with `rules-read` by the first `rules show --ticket` call under the implementer package, and completed by `attempt close`, with these fields.

| Field           | Type                                                      | Req. | Stamped | Meaning                                                                                                     |
| --------------- | --------------------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `schema`        | integer                                                   | yes  | kernel  |                                                                                                             |
| `ticket`        | `A-` id                                                   | yes  | kernel  |                                                                                                             |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).                             |
| `target`        | string                                                    | yes  |         | Task, part, artifact or Change id.                                                                          |
| `attempt`       | integer >= 1                                              | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                               |
| `of`            | integer >= 1                                              | yes  | kernel  | Budget from policy.                                                                                         |
| `scope`         | `full \| high+ \| blockers`                               | yes  |         |                                                                                                             |
| `narrowed-from` | `full \| high+ \| blockers`                               | no   |         |                                                                                                             |
| `escalation`    | boolean                                                   | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.               |
| `opened-at`     | timestamp                                                 | yes  | kernel  |                                                                                                             |
| `author`        | string                                                    | yes  | kernel  |                                                                                                             |
| `closed-at`     | timestamp                                                 | no   | kernel  | Present exactly when `outcome` is.                                                                          |
| `outcome`       | `ok \| fail \| not-run`                                   | no   |         |                                                                                                             |
| `findings`      | array of `{fingerprint, type, file, symbol?}`             | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).                        |
| `dropped`       | array of `L-` ids                                         | no   |         | Findings that fell out of scope N+1.                                                                        |
| `rules-read`    | timestamp                                                 | no   | kernel  | First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`. |
| `package`       | relative path                                             | no   | kernel  | The ticket's active package: the latest `dispatch build` of the ticket (T23-D42).                           |

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

#### Scenario: active package follows the last build

- **WHEN** `dispatch build 02-3 implementer A-7f3k9m2q` and then `dispatch build 02-3 runner A-7f3k9m2q` run
- **THEN** the record's `package` is `dispatch/02-3-runner-A-7f3k9m2q.md`

### Requirement: Evidence manifest

An evidence manifest SHALL record one verification artifact with the working-tree hash of its target at capture (T4, P5), and a manifest SHALL be fresh exactly when that hash equals the current tree hash of its target.

| Field       | Type                                                        | Req. | Stamped | Meaning                                                                                                                 |
| ----------- | ----------------------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `schema`    | integer                                                     | yes  | kernel  |                                                                                                                         |
| `id`        | `E-` id                                                     | yes  | kernel  |                                                                                                                         |
| `kind`      | string                                                      | yes  |         | `tests-scoped`, `lint`, `typecheck`, `ui-capture` or a project kind.                                                    |
| `ticket`    | `A-` id                                                     | yes  |         |                                                                                                                         |
| `target`    | string                                                      | yes  | kernel  | From the ticket.                                                                                                        |
| `at`        | timestamp                                                   | yes  | kernel  |                                                                                                                         |
| `author`    | string                                                      | yes  | kernel  |                                                                                                                         |
| `source`    | `agent:<role> \| kernel`                                    | yes  | kernel  | The role of the ticket's active package; `kernel` without one, and for the `simplify` manifest `attempt close` records. |
| `tree-hash` | hash                                                        | yes  | kernel  |                                                                                                                         |
| `tree`      | array of `{path, hash}`                                     | yes  | kernel  | The files the tree hash covers, each with its `sha256:` hash or `absent`; `evidence check` names the paths that differ. |
| `files`     | array of `{path, hash, stored: committed \| machine}`, >= 1 | yes  | kernel  |                                                                                                                         |
| `verdict`   | `pass \| fail \| not-run`                                   | no   |         |                                                                                                                         |
| `citations` | array of strings                                            | no   |         | JSON pointers or snapshot lines (citation validator).                                                                   |

Tree hash (T23-D7, D16, D45): the scope of a target is its part for a task, the part itself, and every part for the Change. The covered files are the `Files:` paths of every task in the scope that do not match `policy.evidence.non-executable`, plus every file of the working tree (tracked or untracked and not ignored) matching `policy.evidence.build-config`; a path matching `build-config` is always covered. The tree hash is `sha256:` over the covered paths in byte order, each contributing its path, a NUL byte and its bytes, or its path and the marker `absent` when the file does not exist, so a rename, a deletion and a new build-config file change it. `tree` lists the same paths with each file's hash. The same function serves `evidence record`, `evidence check`, `attempt close` and the post-task step nodes (`kernel-pipeline`, Artifact kinds).

#### Scenario: manifest without files

- **WHEN** a manifest has an empty `files` array
- **THEN** validation fails naming `files`

#### Scenario: tree hash ignores non-executable files

- **WHEN** part `02` lists `src/auth/login.ts` and `docs/login.md` in its tasks' `Files:` and only `docs/login.md` changes
- **THEN** the tree hash of `02-3` is unchanged

#### Scenario: tree hash covers build config outside Files

- **WHEN** `pnpm-lock.yaml` is in no task's `Files:` and changes
- **THEN** the tree hash of every task changes

#### Scenario: deleted file changes the tree hash

- **WHEN** `src/auth/login.ts` of part `02` is deleted
- **THEN** the tree hash of `02` changes and `tree` lists the path as `absent`

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                           | Writers                                                                                                                                    | Channel                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `change.md`                    | `change new`; `import` (each v2 design becomes a Change with `source: inferred`, through the code of `change new --inferred`)              | kernel                  |
| `log/`                         | the commands of the entry-type table                                                                                                       | kernel                  |
| `design.md`, `architecture.md` | `design` skill                                                                                                                             | host file tools         |
| `design/parts/`                | `design` skill                                                                                                                             | host file tools         |
| `design/index.md`              | `done`, `rebuild`, `change takeover`                                                                                                       | kernel                  |
| `plan/parts/`                  | `plan` skill; `part split`                                                                                                                 | host file tools; kernel |
| `plan/index.md`                | `done`, `part split`, `rebuild`, `change takeover`                                                                                         | kernel                  |
| `spec-delta/`                  | `design` and `plan` skills                                                                                                                 | host file tools         |
| `attempts/`                    | `attempt open`, `attempt close`, `change takeover`; `rules show --ticket` (the `rules-read` stamp); `dispatch build` (the `package` stamp) | kernel                  |
| `evidence/`                    | `evidence record`; `attempt close` (the `simplify` manifest)                                                                               | kernel                  |
| `dispatch/`                    | `dispatch build`                                                                                                                           | kernel                  |
| `reports/`                     | `log ingest` (the report of every role, on stdin, at the active package's `report` path)                                                   | kernel                  |
| any file (migration)           | `rebuild`, `change takeover`                                                                                                               | kernel                  |
| the Change directory (archive) | `change close`, which writes `dispatch/pruned.md` and `reports/pruned.md` through the prune function unless `archive.keep-evidence` (T30)  | kernel                  |
| `.bdk/rules/<ruleId>.md`       | `rules add --accept`, `rules import`, `import`                                                                                             | kernel                  |

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

### Requirement: State JSON Schema

The JSON Schema of every document kind SHALL be generated from the zod schemas into `schema/state/<kind>.json` by `pnpm build`, and the field tables of this spec SHALL equal the generated schemas.

Files: `change.json`, `entry.json`, `attempt.json`, `evidence.json`, `dispatch.json`, `report.json`, `pruned.json`, `plan-part.json`, `plan-index.json`, `design.json`, `design-part.json`, `design-index.json`, `rule.json`, and `common.json` for the shared definitions (ids, refs, hashes, timestamps). Each file is draft 2020-12 with `$id` under `https://raw.githubusercontent.com/broneq/bdk/v3/schema/state/`, describes the frontmatter only, and is produced by the exporter that writes `schema/settings.json` and `schema/cli/`. CI fails on `git diff --exit-code dist/ schema/`.

#### Scenario: zod changed without export

- **WHEN** a commit changes a state zod schema without the regenerated `schema/state/` file
- **THEN** CI fails on `git diff --exit-code dist/ schema/`

#### Scenario: spec table drifts

- **WHEN** a field table of this spec names a field, requiredness or enum value that the generated schema does not have
- **THEN** the state schema contract test fails naming the document and the field

## ADDED Requirements

### Requirement: Pruned index

A pruned index SHALL record the files that the archive prune removed from `dispatch/` or `reports/` of an archived Change, so that every hash a manifest or an entry names stays checkable (V1-9, T23-D12, D53).

| Field    | Type                                 | Req. | Stamped | Meaning                                        |
| -------- | ------------------------------------ | ---- | ------- | ---------------------------------------------- |
| `schema` | integer                              | yes  | kernel  |                                                |
| `dir`    | `dispatch \| reports`                | yes  | kernel  | The directory it indexes.                      |
| `at`     | timestamp                            | yes  | kernel  |                                                |
| `files`  | array of `{path, hash, bytes}`, >= 0 | yes  | kernel  | Each removed file: name, `sha256:` hash, size. |

The prune function lives in `shared/store`, so `change close` (T30) calls it without a slice edge. It takes an archived Change directory, lists the files of `dispatch/` and `reports/` in name order, writes `pruned.md` in each with their hashes and sizes, then removes them; running it again on a pruned directory changes nothing. The body of `pruned.md` is empty.

#### Scenario: prune replaces bodies with the index

- **WHEN** the prune runs on a Change whose `dispatch/` holds two packages and `reports/` one report
- **THEN** `dispatch/` holds only `pruned.md` listing the two packages with their `sha256:` hashes and sizes, `reports/` holds only `pruned.md` listing the report, and the Change reads without `state/ledger-invalid`

#### Scenario: prune is idempotent

- **WHEN** the prune runs twice on the same Change
- **THEN** the second run writes nothing and the indexes are unchanged
