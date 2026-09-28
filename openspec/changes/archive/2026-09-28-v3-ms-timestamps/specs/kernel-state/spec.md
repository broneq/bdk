# kernel-state delta

## MODIFIED Requirements

### Requirement: Change directory layout

A Change SHALL live in `.bdk/changes/<changeId>/` with exactly the paths below; every per-object file name SHALL carry the object's id or ticket so that two branches never create the same path.

The Change id is `<yyyy-mm-dd>-<slug>`: the kernel clock's UTC date at `change new` and a kebab-case slug of the intent (at most 40 characters). `change new` refuses when the directory exists.

| Path                                   | Document          | Committed | Note                                                                                       |
| -------------------------------------- | ----------------- | --------- | ------------------------------------------------------------------------------------------ |
| `change.md`                            | change            | yes       | Written once.                                                                              |
| `log/<ts>-<type>-<id>.md`              | entry             | yes       | One file per ledger entry (K4); `<ts>` is `at` to the second as `yyyymmddThhmmssZ`.        |
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

#### Scenario: entry file name keeps the second

- **WHEN** `log add` writes an entry whose `at` is `2026-09-25T09:41:07.123Z`
- **THEN** its file is `log/20260925T094107Z-<type>-<id>.md`, and a file whose name names another second is `state/ledger-invalid`

### Requirement: Document schemas and validation

Every document in the layout table except `spec-delta/` and evidence captures SHALL be YAML frontmatter plus a Markdown body, SHALL carry `schema: <n>` in its frontmatter, and SHALL be validated against its zod schema on every write and every read by the kernel.

Frontmatter keys are kebab-case (like settings keys, `kernel-settings`); the CLI JSON outputs render the same fields in camelCase. Optional fields are absent when unknown, never `null`. Timestamps are ISO 8601 UTC; the kernel writes them with milliseconds at a fixed width (`2026-09-25T09:41:07.123Z`), and a read accepts them with or without milliseconds and normalises the second form to `.000`, so documents of both forms compare by time; hashes `sha256:<64 hex>`, paths relative to the project root with `/` (`kernel-cli`, Conventions). Every object is closed: an unknown key is a validation error. A write of an invalid document is refused before any file changes; a committed file that fails on read is `state/ledger-invalid` naming the file and the field.

#### Scenario: invalid committed file

- **WHEN** a committed entry file lacks `refs`
- **THEN** a Change-scoped command exits 4 with `rule: state/ledger-invalid` naming the file and `refs`

#### Scenario: unknown key

- **WHEN** a document's frontmatter carries a key its schema does not declare
- **THEN** validation fails naming the key

#### Scenario: two records of one second keep their order

- **WHEN** two `log add` calls write entries within one second
- **THEN** their `at` values differ, and `log list` lists them in the order they were written, whatever their ids

#### Scenario: second-precision file stays valid

- **WHEN** a committed entry has `at: 2026-09-25T09:41:07Z` and a newer entry has `at: 2026-09-25T09:41:07.500Z`
- **THEN** both read without `state/ledger-invalid`, the first reads as `2026-09-25T09:41:07.000Z`, and `log list` lists it first

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the stage of the `to` of the latest `transition` entry by `at` (two transitions of one millisecond are broken by the later stage in pipeline order, then by the greater id: `done plan-verify` and `part start` at one `at` leave the Change in `execute`), where a stage id is its own stage and a node id or instance id maps to its node's `stage` in the pipeline (`kernel-pipeline`, Pipeline file), and `intent` while the ledger holds no `transition`; the state of every graph node is derived the same way (`kernel-pipeline`, Node states); a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from the attempt records of its round, and task progress from commit trailers (`kernel-loops`); the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

In-place mutations, each by one writer: an entry's `status` and `routed-to`, with the reason appended to its body (`log resolve`, `log route`); `supersedes` of the `--by` entry when an entry is resolved as superseded (`log resolve`); an attempt record from open to close (`attempt close`, `change takeover`), and its removal by the `attempt open` that wrote it when another open ticket of the same loop and target won the race; plan part files when `part split` moves tasks and extends `depends-on`; the generated `plan/index.md` and `design/index.md`; a migration by `bdk rebuild`. Every other committed file in a Change is written once.

#### Scenario: stage from transitions

- **WHEN** the ledger holds transitions to `design` and then to `plan`
- **THEN** the Change's stage is `plan` and no file stores it

#### Scenario: no transition yet

- **WHEN** a Change was just opened by `change new` and its ledger holds no `transition`
- **THEN** its stage is `intent`

#### Scenario: parked and resumed

- **WHEN** the ledger holds a `question` with `park: true` and later a `decision` whose `refs` name that question
- **THEN** the Change is not parked, and before the decision was written it was

#### Scenario: profile raised

- **WHEN** `change.md` says `small` and a `decision` entry carries `profile: large`
- **THEN** the effective profile is `large`

#### Scenario: stage from a done transition

- **WHEN** the latest transition is `to: plan-part:02`, written by `done`
- **THEN** the Change's stage is `plan`

#### Scenario: budgets from records

- **WHEN** the index is deleted and `attempt list` runs
- **THEN** every budget equals the one derived from the committed attempt records and the ledger alone

### Requirement: Rebuildable index

The kernel SHALL keep a SQLite index of the project's Changes in `.bdk/.machine/index.sqlite` as a cache of the committed files (R-store), refresh it lazily before every read, and rebuild it from the files whenever it is missing, of another schema version or unreadable.

Public tables, the contract of `bdk query` (columns in camelCase are snake_case in SQL):

| Table        | One row per                              | Columns                                                                                                                                                                                                                                                                                                         |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`    | Change directory, archived ones included | `id`, `kind`, `profile` (as in `change.md`), `source`, `intent`, `at`, `author`, `archived` (0 or 1), `dir`                                                                                                                                                                                                     |
| `entries`    | ledger entry                             | `change_id`, `id`, `type`, `summary`, `status` (derived: `superseded` when superseded), `source`, `author`, `at`, `ticket`, `supersedes`, `superseded_by`, `review` (0 or 1), `severity`, `category`, `fingerprint`, `routed_to`, `to_stage`, `gate`, `input_hash`, `profile`, `park`, `options` (JSON), `path` |
| `refs`       | ref of an entry                          | `change_id`, `entry_id`, `position`, `ref`                                                                                                                                                                                                                                                                      |
| `attempts`   | attempt record                           | `change_id`, `ticket`, `loop`, `target`, `attempt`, `of`, `scope`, `opened_at`, `closed_at`, `outcome`, `path`                                                                                                                                                                                                  |
| `dispatches` | dispatch package                         | `change_id`, `ticket`, `target`, `role`, `path`                                                                                                                                                                                                                                                                 |

Tables whose name starts with `_` (`_meta` with the schema version, `_files` and `_dirs` for freshness) are internal. Paths are relative to the project root. The index schema version is 4 (T21 added `input_hash`; 4 stores the normalised millisecond times); any other version drops every table and rebuilds. Freshness per Change (V1-9): the modification time and file count of the Change directory and of its `log/`, `attempts/` and `dispatch/` directories; when they equal the recorded values the Change is not read at all; otherwise each file is compared by inode, modification time and size and only new or changed files are parsed and validated, removed ones deleted. A recorded directory state younger than two seconds at recording time is not trusted, so a write in the same clock tick is never missed. A refresh runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, so concurrent kernel processes serialise on it. A committed file that fails validation, or two files carrying one id, are `state/ledger-invalid` naming the files and leave the index unchanged. An index file that SQLite cannot open is deleted and rebuilt once; if that fails too, the command exits 4 with `state/corrupted-index`.

#### Scenario: deleted index

- **WHEN** `.bdk/.machine/index.sqlite` is deleted after entries were written and `bdk log list --json` runs
- **THEN** the index is rebuilt and the listed entries equal those before the deletion

#### Scenario: unreadable index

- **WHEN** `.bdk/.machine/index.sqlite` holds bytes that are not a SQLite database
- **THEN** the next command rebuilds it and exits 0

#### Scenario: index cannot be created

- **WHEN** `.bdk/.machine/index.sqlite` is a directory
- **THEN** a command that reads the index exits 4 with `rule: state/corrupted-index` and `instead` naming `bdk rebuild`

#### Scenario: edited entry is re-read

- **WHEN** an entry's file is rewritten in place (same name, new status) and `log list` runs
- **THEN** the listed status is the new one
