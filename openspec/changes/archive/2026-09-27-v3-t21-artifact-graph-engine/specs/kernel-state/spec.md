## MODIFIED Requirements

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

| Type          | Own fields                                                                                                                                                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `profile` (`small \| large`, optional; written only by kernel commands that raise the profile, `change resume --profile` first; raises the effective profile)                                                                                                                                              |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories)                                                                                                                                          |
| `observation` | `severity` (optional)                                                                                                                                                                                                                                                                                      |
| `blocker`     | `category` (optional)                                                                                                                                                                                                                                                                                      |
| `question`    | `options` (array of strings, optional), `park` (boolean, optional; written only by `change park`; marks the question that parks the Change)                                                                                                                                                                |
| `assumption`  | none                                                                                                                                                                                                                                                                                                       |
| `risk`        | none                                                                                                                                                                                                                                                                                                       |
| `learning`    | `fingerprint` (required, kernel-stamped, see `Fingerprints`), `evidence` (array of ids of attempts or entries that support it, optional), `applies` (array of globs, optional), `routed-to` (`rule \| spec \| nothing`, required when `status` is `routed`)                                                |
| `report`      | `report` (path of the report file, required)                                                                                                                                                                                                                                                               |
| `transition`  | `to` (stage, artifact id, gate id or `closed`, required), `gate` (gate id, optional), `session` (host `session_id`, optional), `command` (typed command text, optional), `skip-verify` (boolean, optional), `input-hash` (`sha256:` hash, optional; written only by `done` for the node named in `to`, P2) |

#### Scenario: summary too long

- **WHEN** an entry's `summary` has 121 characters
- **THEN** validation fails naming `summary`

#### Scenario: learning without fingerprint

- **WHEN** a `learning` entry has no `fingerprint`
- **THEN** validation fails naming `fingerprint`

#### Scenario: park flag from log add

- **WHEN** a caller tries to write a `question` with `park: true` or a `decision` with `profile` through `log add`
- **THEN** no flag of `log add` can set either field, so only `change park` and `change resume` produce them

#### Scenario: input hash only from done

- **WHEN** a `transition` carries `input-hash`
- **THEN** its `source` is `kernel` and its `to` names a pipeline node, because only `done` writes the field

### Requirement: Design artifacts and design index

`design.md`, `architecture.md` and design parts SHALL carry frontmatter, and `design/index.md` SHALL be generated from the design parts only.

`design.md` and `architecture.md`: `schema`, `title`; `design.md` also carries the optional boolean `architecture` (default `true`), which the `design` skill sets to `false` for a product-only Change so the `architecture` node is skipped (T02 decision R-5, `kernel-pipeline`, Artifact kinds). Design part (`design/parts/<nn>-<slug>.md`): `schema`, `id` (two digits, equal to `<nn>`), `title`, `depends-on` (array of design part ids). Design index: `schema`, `generated: true`, `parts` (array of `{id, title, depends-on}`), same determinism and cycle rule as the plan index.

#### Scenario: design without frontmatter

- **WHEN** `bdk done design` runs on a `design.md` without `schema`
- **THEN** the exit code is 2 with `rule: policy/validation-failed` naming `schema`

#### Scenario: product-only design

- **WHEN** `design.md` carries `architecture: false`
- **THEN** it validates, and a `design.md` carrying `architecture: "no"` fails naming `architecture`

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the stage of the `to` of the latest `transition` entry by `at` (ties broken by the greater id), where a stage id is its own stage and a node id or instance id maps to its node's `stage` in the pipeline (`kernel-pipeline`, Pipeline file), and `intent` while the ledger holds no `transition`; the state of every graph node is derived the same way (`kernel-pipeline`, Node states); a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from its attempt records; the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

In-place mutations, each by one writer: an entry's `status` and `routed-to`, with the reason appended to its body (`log resolve`, `log route`); `supersedes` of the `--by` entry when an entry is resolved as superseded (`log resolve`); an attempt record from open to close (`attempt close`, `change takeover`); the generated `plan/index.md` and `design/index.md`; a migration by `bdk rebuild`. Every other committed file in a Change is written once.

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
| `decision`    | `log add`, `log ingest` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split`, `done` for the profile raise of a split design (`kernel`)                          |
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

Tables whose name starts with `_` (`_meta` with the schema version, `_files` and `_dirs` for freshness) are internal. Paths are relative to the project root. The index schema version is 3 (T21 added `input_hash`); any other version drops every table and rebuilds. Freshness per Change (V1-9): the modification time and file count of the Change directory and of its `log/`, `attempts/` and `dispatch/` directories; when they equal the recorded values the Change is not read at all; otherwise each file is compared by inode, modification time and size and only new or changed files are parsed and validated, removed ones deleted. A recorded directory state younger than two seconds at recording time is not trusted, so a write in the same clock tick is never missed. A refresh runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, so concurrent kernel processes serialise on it. A committed file that fails validation, or two files carrying one id, are `state/ledger-invalid` naming the files and leave the index unchanged. An index file that SQLite cannot open is deleted and rebuilt once; if that fails too, the command exits 4 with `state/corrupted-index`.

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
