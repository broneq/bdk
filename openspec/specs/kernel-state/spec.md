# kernel-state Specification

## Purpose

The state contract of BDK v3: the Change directory, the schema of every document the kernel writes or validates in it and of rule files, the id, fingerprint and versioning rules, the write map naming a writer for every file and entry type, and the guarantee that two branches of one Change merge without conflict.

## Requirements

### Requirement: Change directory layout

A Change SHALL live in `.bdk/changes/<changeId>/` with exactly the paths below; every per-object file name SHALL carry the object's id or ticket so that two branches never create the same path.

The Change id is `<yyyy-mm-dd>-<slug>`: the kernel clock's UTC date at `change new` and a kebab-case slug of the intent (at most 40 characters). `change new` refuses when the directory exists.

| Path                                   | Document          | Committed | Note                                                                                       |
| -------------------------------------- | ----------------- | --------- | ------------------------------------------------------------------------------------------ |
| `change.md`                            | change            | yes       | Written once.                                                                              |
| `log/<ts>-<type>-<id>.md`              | entry             | yes       | One file per ledger entry (K4); `<ts>` is `at` as `yyyymmddThhmmssZ`.                      |
| `design.md`                            | design artifact   | yes       | Profiles without design parts.                                                             |
| `architecture.md`                      | design artifact   | yes       | T02 decision R-5.                                                                          |
| `design/parts/<nn>-<slug>.md`          | design part       | yes       | `large` profile (R-4).                                                                     |
| `design/index.md`                      | design index      | yes       | Generated from the design parts.                                                           |
| `plan/parts/<nn>-<slug>.md`            | plan part         | yes       |                                                                                            |
| `plan/index.md`                        | plan index        | yes       | Generated from the plan parts.                                                             |
| `spec-delta/<capability>.md`           | spec delta        | yes       | OpenSpec delta format (T30); carries no `schema` field and has no file in `schema/state/`. |
| `attempts/<loop>-<target>-<ticket>.md` | attempt           | yes       | One file per ticket (replaces the design's append-only `<loop>-<target>.md`).              |
| `evidence/<target>-<evidenceId>.md`    | evidence manifest | yes       | Binary captures live in `.bdk/.machine/evidence/`.                                         |
| `evidence/<target>-<evidenceId>.<ext>` | evidence capture  | yes       | A capture its manifest lists with `stored: committed`; not schema-checked.                 |
| `dispatch/<target>-<role>-<ticket>.md` | dispatch package  | yes       | The design's attempt number `<n>` becomes the ticket.                                      |
| `reports/<target>-<role>-<ticket>.md`  | report            | yes       |                                                                                            |

`<target>` is a task id (`02-3`), a part id (`02`), an artifact id or the Change id, the same value as the attempt's `target`. Rule files live outside the Change as `.bdk/rules/<ruleId>.md` (T02 decision Q-5). Nothing else is created in a Change directory; `change close` moves it to `.bdk/changes/archive/` (T30).

#### Scenario: parallel creation never shares a path

- **WHEN** two branches each create an entry, an attempt, an evidence manifest, a dispatch package and a report for the same task of the same Change
- **THEN** the ten file paths are pairwise distinct

#### Scenario: unknown file in a Change

- **WHEN** a Change directory holds a file whose path matches no row of the layout table
- **THEN** reading the Change fails with `state/ledger-invalid` naming the path

### Requirement: Document schemas and validation

Every document in the layout table except `spec-delta/` and evidence captures SHALL be YAML frontmatter plus a Markdown body, SHALL carry `schema: <n>` in its frontmatter, and SHALL be validated against its zod schema on every write and every read by the kernel.

Frontmatter keys are kebab-case (like settings keys, `kernel-settings`); the CLI JSON outputs render the same fields in camelCase. Optional fields are absent when unknown, never `null`. Timestamps are ISO 8601 UTC with seconds, hashes `sha256:<64 hex>`, paths relative to the project root with `/` (`kernel-cli`, Conventions). Every object is closed: an unknown key is a validation error. A write of an invalid document is refused before any file changes; a committed file that fails on read is `state/ledger-invalid` naming the file and the field.

#### Scenario: invalid committed file

- **WHEN** a committed entry file lacks `refs`
- **THEN** a Change-scoped command exits 4 with `rule: state/ledger-invalid` naming the file and `refs`

#### Scenario: unknown key

- **WHEN** a document's frontmatter carries a key its schema does not declare
- **THEN** validation fails naming the key

### Requirement: Schema versions and migrations

Each document kind SHALL have an integer schema version, starting at 1; the kernel SHALL read only documents at its current version, and `bdk rebuild` SHALL migrate older ones in place.

A document whose `schema` is lower than the kernel's is `state/ledger-invalid` with `instead` naming `bdk rebuild`. `bdk rebuild` applies the registered migrations of that kind in order (`n` to `n+1`), validates the result against the current schema and rewrites the file; a document with no migration path stays and is reported. A document whose `schema` is higher than the kernel's is `state/ledger-invalid` whose `detail` names the plugin version that wrote it and says to upgrade BDK; `rebuild` never downgrades. Version 1 has no migrations.

#### Scenario: older document

- **WHEN** a committed attempt record carries `schema: 1` and the kernel's attempt schema is at version 2 with a registered migration
- **THEN** Change-scoped commands exit 4 naming `bdk rebuild`, and after `bdk rebuild` the file carries `schema: 2` and validates

#### Scenario: newer document

- **WHEN** a committed entry carries a `schema` higher than the kernel's
- **THEN** the exit code is 4 with `rule: state/ledger-invalid` and `bdk rebuild` leaves the file unchanged

### Requirement: Identifiers

Ledger, ticket and evidence ids SHALL be merge-safe and non-sequential: a prefix `L-`, `A-` or `E-` followed by eight characters of `[0-9a-z]` drawn from a cryptographically secure random source, with no allocator, counter, marker file or lock.

Within the active Change an id is bare (`L-m2x9v7qa`); across Changes it is qualified (`<changeId>/L-m2x9v7qa`). The writer retries generation when the id already exists in the Change. Two branches may, with probability about 10^-5 at ten thousand ids, produce the same id; the paths still differ (they carry `<ts>` and `<type>`, or a different target), so the merge succeeds, and reading the merged Change reports `state/ledger-invalid` naming both files. Order is never read from an id: it comes from `at`. Rule ids `[PREFIX-n]` are not merge-safe by design and follow `Rule file frontmatter`.

#### Scenario: fifteen parallel writers

- **WHEN** fifteen processes each generate an entry id in the same Change at the same time
- **THEN** all fifteen ids are distinct and no lock or marker file is created

#### Scenario: qualified reference

- **WHEN** a ref reads `2026-09-25-passwordless-login/L-m2x9v7qa`
- **THEN** it parses as Change `2026-09-25-passwordless-login` and entry `L-m2x9v7qa`

### Requirement: Change document

`change.md` SHALL hold the Change's identity and intent, SHALL be written once by `change new` and SHALL never be mutated.

| Field        | Type                     | Req. | Stamped | Meaning                                                                                |
| ------------ | ------------------------ | ---- | ------- | -------------------------------------------------------------------------------------- |
| `schema`     | integer                  | yes  | kernel  | Document version.                                                                      |
| `id`         | Change id                | yes  | kernel  |                                                                                        |
| `kind`       | `feature \| bug`         | yes  |         | Graph variant (T02 decision R-8).                                                      |
| `profile`    | `tiny \| small \| large` | yes  |         | Profile at opening; a later raise is a ledger entry, never an edit.                    |
| `intent`     | string                   | yes  |         | The intent (for `bug`, the reproduction). The only place the intent lives (R-12).      |
| `source`     | `user \| inferred`       | yes  | kernel  | `inferred` only from `change new --inferred` (R-12).                                   |
| `at`         | timestamp                | yes  | kernel  |                                                                                        |
| `author`     | string                   | yes  | kernel  | Git `user.name <user.email>`.                                                          |
| `overridden` | array of key names       | yes  | kernel  | Settings keys the local layer overrides at opening, names only (D4b); empty when none. |

The body is empty.

#### Scenario: inferred Change

- **WHEN** a stage skill without an active Change calls `change new --inferred "<first sentence>"`
- **THEN** `change.md` carries `source: inferred` and no later command rewrites the file

### Requirement: Ledger entry

A ledger entry SHALL be one file with the common fields below plus the fields of its type, and its body SHALL be free Markdown.

| Field        | Type                                                   | Req. | Stamped | Meaning                                                                                  |
| ------------ | ------------------------------------------------------ | ---- | ------- | ---------------------------------------------------------------------------------------- |
| `schema`     | integer                                                | yes  | kernel  |                                                                                          |
| `id`         | `L-` id                                                | yes  | kernel  |                                                                                          |
| `type`       | one of the ten types below                             | yes  |         | K1 plus `transition`.                                                                    |
| `summary`    | string, 1-120 characters                               | yes  |         |                                                                                          |
| `status`     | `proposed \| accepted \| resolved \| routed`           | yes  |         | `superseded` is derived, never stored (see `Derived state and mutation`).                |
| `source`     | `user \| policy \| inferred \| kernel \| agent:<role>` | yes  | kernel  | P1; which writer may stamp which value is in the write map.                              |
| `author`     | string                                                 | yes  | kernel  |                                                                                          |
| `at`         | timestamp                                              | yes  | kernel  |                                                                                          |
| `ticket`     | `A-` id                                                | no   | kernel  | The ticket the entry was written under; absent for main-thread and hook writes.          |
| `refs`       | array of refs, at least one                            | yes  |         | Files, symbols (`path#symbol`), parts, tasks, rule ids, artifact ids or (qualified) ids. |
| `supersedes` | id                                                     | no   |         | The entry this one replaces.                                                             |
| `review`     | boolean                                                | no   |         | "To be reviewed" at a gate (D3, T1).                                                     |

Types and their own fields:

| Type          | Own fields                                                                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | none                                                                                                                                                                                                                                                        |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories)                                                                                           |
| `observation` | `severity` (optional)                                                                                                                                                                                                                                       |
| `blocker`     | `category` (optional)                                                                                                                                                                                                                                       |
| `question`    | `options` (array of strings, optional)                                                                                                                                                                                                                      |
| `assumption`  | none                                                                                                                                                                                                                                                        |
| `risk`        | none                                                                                                                                                                                                                                                        |
| `learning`    | `fingerprint` (required, kernel-stamped, see `Fingerprints`), `evidence` (array of ids of attempts or entries that support it, optional), `applies` (array of globs, optional), `routed-to` (`rule \| spec \| nothing`, required when `status` is `routed`) |
| `report`      | `report` (path of the report file, required)                                                                                                                                                                                                                |
| `transition`  | `to` (stage, artifact id, gate id or `closed`, required), `gate` (gate id, optional), `session` (host `session_id`, optional), `command` (typed command text, optional), `skip-verify` (boolean, optional)                                                  |

#### Scenario: summary too long

- **WHEN** an entry's `summary` has 121 characters
- **THEN** validation fails naming `summary`

#### Scenario: learning without fingerprint

- **WHEN** a `learning` entry has no `fingerprint`
- **THEN** validation fails naming `fingerprint`

### Requirement: Fingerprints

The kernel SHALL compute fingerprints, never accept them as input, with one normalisation shared by `learning` entries and attempt findings.

`normalise(text)`: Unicode NFKC, lowercase, every run of decimal digits replaced by `#`, every run of characters that are neither letters, digits nor `#` replaced by one space, trimmed. A fingerprint is `sha256:` plus the hex SHA-256 of its parts joined by U+001F: for a `learning` entry `learning`, `normalise(summary)`; for an attempt finding `finding`, the entry type, the file path, the symbol (empty when none) and `normalise(problem)`. The same lesson worded differently gets a different fingerprint; semantic grouping is T31's.

#### Scenario: cosmetic variants

- **WHEN** two `learning` summaries differ only in case, punctuation, whitespace and a line number
- **THEN** their fingerprints are equal

#### Scenario: fingerprint as input

- **WHEN** `log add` receives a `fingerprint` field
- **THEN** the exit code is 3 with `rule: input/forbidden-field`

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open` and completed by `attempt close`, with these fields.

| Field           | Type                                          | Req. | Stamped | Meaning                                                                                               |
| --------------- | --------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------- |
| `schema`        | integer                                       | yes  | kernel  |                                                                                                       |
| `ticket`        | `A-` id                                       | yes  | kernel  |                                                                                                       |
| `loop`          | string                                        | yes  |         | Loop kind from policy (`task-redispatch`, `verify-fix`, `review-fix`, `verifier`, `task-escalation`). |
| `target`        | string                                        | yes  |         | Task, part, artifact or Change id.                                                                    |
| `attempt`       | integer >= 1                                  | yes  | kernel  | Derived from the committed records of the same loop and target.                                       |
| `of`            | integer >= 1                                  | yes  | kernel  | Budget from policy.                                                                                   |
| `scope`         | `full \| high+ \| blockers`                   | yes  |         |                                                                                                       |
| `narrowed-from` | `full \| high+ \| blockers`                   | no   |         |                                                                                                       |
| `escalation`    | boolean                                       | no   |         | One-shot escalation ticket.                                                                           |
| `opened-at`     | timestamp                                     | yes  | kernel  |                                                                                                       |
| `author`        | string                                        | yes  | kernel  |                                                                                                       |
| `closed-at`     | timestamp                                     | no   | kernel  | Present exactly when `outcome` is.                                                                    |
| `outcome`       | `ok \| fail \| not-run`                       | no   |         |                                                                                                       |
| `findings`      | array of `{fingerprint, type, file, symbol?}` | no   | kernel  | Finding fingerprints of a `fail` (oscillation check).                                                 |
| `dropped`       | array of `L-` ids                             | no   |         | Findings that fell out of scope N+1.                                                                  |

The body is the close reason. `not-run` counters and budgets are derived from all records of a loop and target, never stored.

#### Scenario: closed without timestamp

- **WHEN** an attempt record has `outcome` but no `closed-at`
- **THEN** validation fails naming `closed-at`

### Requirement: Evidence manifest

An evidence manifest SHALL record one verification artifact with the working-tree hash at capture (T4, P5).

| Field       | Type                                                        | Req. | Stamped | Meaning                                                              |
| ----------- | ----------------------------------------------------------- | ---- | ------- | -------------------------------------------------------------------- |
| `schema`    | integer                                                     | yes  | kernel  |                                                                      |
| `id`        | `E-` id                                                     | yes  | kernel  |                                                                      |
| `kind`      | string                                                      | yes  |         | `tests-scoped`, `lint`, `typecheck`, `ui-capture` or a project kind. |
| `ticket`    | `A-` id                                                     | yes  |         |                                                                      |
| `target`    | string                                                      | yes  | kernel  | From the ticket.                                                     |
| `at`        | timestamp                                                   | yes  | kernel  |                                                                      |
| `author`    | string                                                      | yes  | kernel  |                                                                      |
| `source`    | `agent:<role> \| kernel`                                    | yes  | kernel  |                                                                      |
| `tree-hash` | hash                                                        | yes  | kernel  |                                                                      |
| `files`     | array of `{path, hash, stored: committed \| machine}`, >= 1 | yes  | kernel  |                                                                      |
| `verdict`   | `pass \| fail \| not-run`                                   | no   |         |                                                                      |
| `citations` | array of strings                                            | no   |         | JSON pointers or snapshot lines (citation validator).                |

#### Scenario: manifest without files

- **WHEN** a manifest has an empty `files` array
- **THEN** validation fails naming `files`

### Requirement: Dispatch package

A dispatch package's frontmatter SHALL carry the fields below (K3, K4, P10); its body sections belong to T23.

| Field            | Type                        | Req. | Stamped | Meaning                                             |
| ---------------- | --------------------------- | ---- | ------- | --------------------------------------------------- |
| `schema`         | integer                     | yes  | kernel  |                                                     |
| `ticket`         | `A-` id                     | yes  | kernel  |                                                     |
| `target`         | string                      | yes  | kernel  |                                                     |
| `role`           | string                      | yes  | kernel  | Role skill name (`implementer`, `verifier`, ...).   |
| `attempt`        | integer >= 1                | yes  | kernel  |                                                     |
| `of`             | integer >= 1                | yes  | kernel  |                                                     |
| `scope`          | `full \| high+ \| blockers` | yes  | kernel  |                                                     |
| `at`             | timestamp                   | yes  | kernel  |                                                     |
| `kernel-version` | string                      | yes  | kernel  | P10.                                                |
| `template-hash`  | hash                        | yes  | kernel  | P10.                                                |
| `report`         | path                        | yes  | kernel  | Where the role's report is written (`reports/...`). |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

### Requirement: Report envelope

A report's frontmatter SHALL be the role's envelope (at most 15 rendered lines) and its body SHALL be the full report; a read-only role's body ends with one fenced `bdk-entries` block.

| Field      | Type                                                     | Req. | Meaning                                                 |
| ---------- | -------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `schema`   | integer                                                  | yes  |                                                         |
| `ticket`   | `A-` id                                                  | yes  |                                                         |
| `role`     | string                                                   | yes  |                                                         |
| `status`   | `done \| done-with-concerns \| needs-context \| blocked` | yes  | The four statuses of the v2 return contract.            |
| `files`    | array of paths                                           | yes  | Files the role changed; empty for read-only roles.      |
| `entries`  | array of `L-` ids                                        | yes  | Entries the role wrote with `log add`; empty when none. |
| `evidence` | array of `E-` ids                                        | yes  | Manifests the role recorded; empty when none.           |
| `reason`   | string                                                   | no   | Required for `blocked` and `needs-context`.             |

#### Scenario: blocked without reason

- **WHEN** a report has `status: blocked` and no `reason`
- **THEN** validation fails naming `reason`

### Requirement: Plan part and plan index

A plan part's frontmatter SHALL carry the part fields of P6 and P7, and `plan/index.md` SHALL be generated from the parts only.

Plan part (`plan/parts/<nn>-<slug>.md`; task grammar in the body belongs to T21 and T22):

| Field             | Type                                | Req. | Meaning                         |
| ----------------- | ----------------------------------- | ---- | ------------------------------- |
| `schema`          | integer                             | yes  |                                 |
| `id`              | two digits                          | yes  | Equals `<nn>` of the file name. |
| `title`           | string                              | yes  |                                 |
| `goal`            | string                              | yes  |                                 |
| `success-measure` | string                              | yes  | What a reviewer can observe.    |
| `do-not-touch`    | array of globs                      | yes  | Empty allowed.                  |
| `depends-on`      | array of part ids                   | yes  | Empty allowed.                  |
| `spec-impact`     | `none` or array of capability names | yes  | D2.                             |

Plan index: `schema`, `generated: true`, `parts` (array of `{id, title, depends-on, wave}`), where `wave` is 1 for a part without dependencies and one more than the highest wave of its dependencies. The body is a rendered table. The index is a pure function of the parts: regenerating it from unchanged parts yields the same bytes; a dependency cycle or a missing part id fails generation.

#### Scenario: regenerated index

- **WHEN** `plan/index.md` is deleted and regenerated from unchanged parts
- **THEN** its bytes equal the deleted file

#### Scenario: dependency cycle

- **WHEN** part `01` depends on `02` and `02` on `01`
- **THEN** generation fails naming both parts

### Requirement: Design artifacts and design index

`design.md`, `architecture.md` and design parts SHALL carry frontmatter, and `design/index.md` SHALL be generated from the design parts only.

`design.md` and `architecture.md`: `schema`, `title`. Design part (`design/parts/<nn>-<slug>.md`): `schema`, `id` (two digits, equal to `<nn>`), `title`, `depends-on` (array of design part ids). Design index: `schema`, `generated: true`, `parts` (array of `{id, title, depends-on}`), same determinism and cycle rule as the plan index.

#### Scenario: design without frontmatter

- **WHEN** `bdk done design` runs on a `design.md` without `schema`
- **THEN** the exit code is 2 with `rule: policy/validation-failed` naming `schema`

### Requirement: Rule file frontmatter

A rule file `.bdk/rules/<ruleId>.md` SHALL carry the frontmatter below and the rule text as its body (R-rule-id, T5, T02 decision Q-5).

| Field      | Type                                           | Req.                   | Meaning                                                                  |
| ---------- | ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `schema`   | integer                                        | yes                    |                                                                          |
| `id`       | `[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[1-9][0-9]*` | yes                    | Equals the file name without `.md` (`CQ-4`, `BDK-SEC-2`).                |
| `kind`     | `house \| knowledge`                           | yes                    | T5.                                                                      |
| `applies`  | array of globs                                 | no                     | Absent: every file.                                                      |
| `roles`    | array of role names                            | no                     | Absent: every role.                                                      |
| `severity` | `critical \| high \| medium \| low`            | yes                    |                                                                          |
| `origin`   | `bdk \| import \| <changeId>/<L-id>`           | yes                    | The shipped pack, `rules import`, or the `learning` entry it came from.  |
| `since`    | date `yyyy-mm-dd`                              | yes                    |                                                                          |
| `source`   | string                                         | when `kind: knowledge` | Where the stated fact comes from (T5); unrelated to provenance `source`. |
| `verified` | date                                           | when `kind: knowledge` |                                                                          |
| `removed`  | string                                         | no                     | Tombstone reason; the id is never reused.                                |

Two Changes that accept a rule with the same number in parallel create the same path; that add/add conflict is the permitted "same rule written two ways" conflict, and the later Change renumbers (numbers are never reused).

#### Scenario: knowledge rule without verification

- **WHEN** a rule has `kind: knowledge` and no `verified`
- **THEN** validation fails naming `verified`

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the `to` of the latest `transition` entry by `at` (ties broken by id); a Change is parked while its latest park `question` has no later resume `decision` referencing it; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from its attempt records; the effective profile is `change.md`'s `profile` raised by later profile `decision` entries.

In-place mutations, each by one writer: an entry's `status` and `routed-to`, with the reason appended to its body (`log resolve`, `log route`); `supersedes` of the `--by` entry when an entry is resolved as superseded (`log resolve`); an attempt record from open to close (`attempt close`, `change takeover`); the generated `plan/index.md` and `design/index.md`; a migration by `bdk rebuild`. Every other committed file in a Change is written once.

#### Scenario: stage from transitions

- **WHEN** the ledger holds transitions to `design` and then to `plan`
- **THEN** the Change's stage is `plan` and no file stores it

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                           | Writers                                                                                                                       | Channel                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `change.md`                    | `change new`; `import` (each v2 design becomes a Change with `source: inferred`, through the code of `change new --inferred`) | kernel                  |
| `log/`                         | the commands of the entry-type table                                                                                          | kernel                  |
| `design.md`, `architecture.md` | `design` skill                                                                                                                | host file tools         |
| `design/parts/`                | `design` skill                                                                                                                | host file tools         |
| `design/index.md`              | `done`, `rebuild`                                                                                                             | kernel                  |
| `plan/parts/`                  | `plan` skill; `part split`                                                                                                    | host file tools; kernel |
| `plan/index.md`                | `done`, `part split`, `rebuild`                                                                                               | kernel                  |
| `spec-delta/`                  | `design` and `plan` skills                                                                                                    | host file tools         |
| `attempts/`                    | `attempt open`, `attempt close`, `change park`, `change takeover`                                                             | kernel                  |
| `evidence/`                    | `evidence record`                                                                                                             | kernel                  |
| `dispatch/`                    | `dispatch build`                                                                                                              | kernel                  |
| `reports/`                     | worker and runner roles at the package's `report` path; `log ingest` (a read-only role's report on stdin); `dispatch run`     | host file tools; kernel |
| any file (migration)           | `rebuild`                                                                                                                     | kernel                  |
| the Change directory (archive) | `change close`                                                                                                                | kernel                  |
| `.bdk/rules/<ruleId>.md`       | `rules add --accept`, `rules import`, `import`                                                                                | kernel                  |

Entry types (`source` values each writer stamps):

| Type          | Writers and `source`                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decision`    | `log add`, `log ingest` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split` (`kernel`)                                                                          |
| `finding`     | `log add`, `log ingest`; `attempt close` and `commit` for undeclared files and dropped findings (`kernel`)                                                                                                   |
| `observation` | `log add`, `log ingest` (including a downgraded uncategorised blocker, P8)                                                                                                                                   |
| `blocker`     | `log add`, `log ingest`                                                                                                                                                                                      |
| `question`    | `log add`, `log ingest`; `change park` (`kernel`)                                                                                                                                                            |
| `assumption`  | `log add`, `log ingest`; `change new` for the proposed profile (`kernel`)                                                                                                                                    |
| `risk`        | `log add`, `log ingest`                                                                                                                                                                                      |
| `learning`    | `log add`, `log ingest`, `rules add` (`agent:<role>` or `kernel`); status by `log route`                                                                                                                     |
| `report`      | `log add`, `log ingest`                                                                                                                                                                                      |
| `transition`  | `hooks prompt-expansion` (`user` for a typed stage command, `policy` for an auto gate, `kernel` for a stage without a gate); `done`, `part start`, `part done`, `change takeover`, `change close` (`kernel`) |

Rules without exception: `intent` lives only in `change.md`, written only by `change new` (which `import` reuses); a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `log add` and `log ingest` never write `transition` and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

#### Scenario: every file has a writer

- **WHEN** the write map contract test walks the layout table and the ten entry types
- **THEN** each has at least one writer in the tables above

#### Scenario: log add cannot write a transition

- **WHEN** `log add` is called with `type: transition`
- **THEN** the exit code is 3 and no file is written

### Requirement: Write map enforcement

The kernel SHALL enforce the write map for every file a kernel command writes, and contract tests SHALL enforce the map against the CLI contract; files written through host file tools SHALL be validated at `done`.

Kernel-enforced: only `shared/store` builds Change paths and writes them; schema validation on write and read; kernel-stamped fields are never taken from input (`input/forbidden-field`); availability classes keep subagents off orchestrator commands (`hooks pre-tool`, T24). Contract-enforced: every kernel writer in the tables is a command of `schema/cli/commands.json` whose availability is `orchestrator`, `agent` or `hook` (never `read`) and whose `writes[]` covers the path; every Change path in any command's `writes[]` appears in the file table. Documented and validated at `done`: files written through host file tools (design and plan artifacts, `spec-delta/`, worker reports); the kernel cannot see their writer, and whether `hooks pre-tool` denies host-tool writes into kernel-channel paths is T24's decision.

#### Scenario: writer is a read command

- **WHEN** the file table names a command whose availability is `read`
- **THEN** the write map contract test fails naming the command

#### Scenario: undeclared write

- **WHEN** a command's `writes[]` lists a Change path that the file table does not name it for
- **THEN** the write map contract test fails naming the command and the path

### Requirement: State JSON Schema

The JSON Schema of every document kind SHALL be generated from the zod schemas into `schema/state/<kind>.json` by `pnpm build`, and the field tables of this spec SHALL equal the generated schemas.

Files: `change.json`, `entry.json`, `attempt.json`, `evidence.json`, `dispatch.json`, `report.json`, `plan-part.json`, `plan-index.json`, `design.json`, `design-part.json`, `design-index.json`, `rule.json`, and `common.json` for the shared definitions (ids, refs, hashes, timestamps). Each file is draft 2020-12 with `$id` under `https://raw.githubusercontent.com/broneq/bdk/v3/schema/state/`, describes the frontmatter only, and is produced by the exporter that writes `schema/settings.json` and `schema/cli/`. CI fails on `git diff --exit-code dist/ schema/`.

#### Scenario: zod changed without export

- **WHEN** a commit changes a state zod schema without the regenerated `schema/state/` file
- **THEN** CI fails on `git diff --exit-code dist/ schema/`

#### Scenario: spec table drifts

- **WHEN** a field table of this spec names a field, requiredness or enum value that the generated schema does not have
- **THEN** the state schema contract test fails naming the document and the field

### Requirement: State fixture

A fixture `.bdk/` directory with at least one complete Change, holding every document kind and every entry type, and rule files SHALL validate file by file against both the zod schemas and the exported JSON Schemas.

#### Scenario: fixture validates

- **WHEN** the state contract test maps each fixture file to its document kind by the layout table
- **THEN** every file validates with zod and with Ajv against `schema/state/`, and no file is unmapped

#### Scenario: fixture coverage

- **WHEN** a document kind or an entry type is absent from the fixture
- **THEN** the state contract test fails naming it

### Requirement: Two-branch merge

Two branches that work on the same Change in parallel SHALL merge without conflict, except when both edit the same rule.

#### Scenario: parallel work merges cleanly

- **WHEN** branches A and B fork from a commit holding a Change, each writes entries of several types, opens and closes attempts, records evidence, writes a dispatch package and a report, accepts a different rule and adds a delta for a different capability, and B is merged into A with `git merge`
- **THEN** the merge has no conflict and every file of the merged Change and the rules validates, with no duplicate id

#### Scenario: the same rule edited two ways

- **WHEN** both branches edit the body of the same `.bdk/rules/<ruleId>.md` differently
- **THEN** the merge conflicts on that file only
