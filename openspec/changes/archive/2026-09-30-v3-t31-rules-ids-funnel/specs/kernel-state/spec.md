## MODIFIED Requirements

### Requirement: Ledger entry

A ledger entry SHALL be one file with the common fields below plus the fields of its type, and its body SHALL be free Markdown.

| Field        | Type                                                   | Req. | Stamped | Meaning                                                                                  |
| ------------ | ------------------------------------------------------ | ---- | ------- | ---------------------------------------------------------------------------------------- |
| `schema`     | integer                                                | yes  | kernel  |                                                                                          |
| `id`         | `L-` id                                                | yes  | kernel  |                                                                                          |
| `type`       | one of the ten types below                             | yes  |         | K1 plus `transition`.                                                                    |
| `summary`    | string, 1-120 characters                               | yes  |         |                                                                                          |
| `status`     | `proposed \| accepted \| resolved`                     | yes  |         | `superseded` is derived, never stored (see `Derived state and mutation`).                |
| `source`     | `user \| policy \| inferred \| kernel \| agent:<role>` | yes  | kernel  | P1; which writer may stamp which value is in the write map.                              |
| `author`     | string                                                 | yes  | kernel  |                                                                                          |
| `at`         | timestamp                                              | yes  | kernel  |                                                                                          |
| `ticket`     | `A-` id                                                | no   | kernel  | The ticket the entry was written under; absent for main-thread and hook writes.          |
| `refs`       | array of refs, at least one                            | yes  |         | Files, symbols (`path#symbol`), parts, tasks, rule ids, artifact ids or (qualified) ids. |
| `supersedes` | id                                                     | no   |         | The entry this one replaces.                                                             |
| `review`     | boolean                                                | no   |         | "To be reviewed" at a gate (D3, T1).                                                     |

Types and their own fields:

| Type          | Own fields                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decision`    | `profile` (`small \| large`, optional; written only by kernel commands that raise the profile, `change resume --profile` first; raises the effective profile)                                                                                                                                                                                                                  |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories)                                                                                                                                                                                                              |
| `observation` | `severity` (optional)                                                                                                                                                                                                                                                                                                                                                          |
| `blocker`     | `category` (optional)                                                                                                                                                                                                                                                                                                                                                          |
| `question`    | `options` (array of strings, optional), `park` (boolean, optional; written only by `change park` and by `attempt close` at the end of the ladder; marks the question that parks the Change)                                                                                                                                                                                    |
| `assumption`  | none                                                                                                                                                                                                                                                                                                                                                                           |
| `risk`        | none                                                                                                                                                                                                                                                                                                                                                                           |
| `learning`    | `fingerprint` (required, kernel-stamped, see `Fingerprints`), `evidence` (array of ids of attempts or entries that support it, optional), `applies` (array of globs, optional; the files the lesson is about)                                                                                                                                                                  |
| `report`      | `report` (path of the report file, required)                                                                                                                                                                                                                                                                                                                                   |
| `transition`  | `to` (stage, artifact id, gate id or `closed`, required), `gate` (gate id, optional), `session` (host `session_id`, optional), `command` (typed command text, optional), `skip-verify` (boolean, optional), `input-hash` (`sha256:` hash, optional; written only by `done` and `part done` for the node named in `to`, P2; a transition carrying it is the node's done marker) |

#### Scenario: summary too long

- **WHEN** an entry's `summary` has 121 characters
- **THEN** validation fails naming `summary`

#### Scenario: learning without fingerprint

- **WHEN** a `learning` entry has no `fingerprint`
- **THEN** validation fails naming `fingerprint`

#### Scenario: park flag from log add

- **WHEN** a caller tries to write a `question` with `park: true` or a `decision` with `profile` through `log add`
- **THEN** no flag of `log add` and no field of a `log ingest` block can set either field, so only kernel commands produce them: `park` by `change park` and `attempt close`, `profile` by `change resume` and `done`

#### Scenario: input hash only from done

- **WHEN** a `transition` carries `input-hash`
- **THEN** its `source` is `kernel` and its `to` names a pipeline node, because only `done` writes the field

#### Scenario: ladder question parks

- **WHEN** `attempt close` ends the ladder of `task-redispatch 02-3`
- **THEN** the written `question` carries `park: true`, `source: kernel` and `options`, and it validates

#### Scenario: routed is no longer a status

- **WHEN** a `learning` entry carries `status: routed` or a `routed-to` field
- **THEN** validation fails naming the field

### Requirement: Dispatch package

A dispatch package SHALL be written only by `dispatch build`, with the frontmatter fields below (K3, K4, P10) and the body sections that `kernel-cli/dispatch`, `bdk dispatch build`, lists in order; the whole file is at most 12 288 bytes.

| Field            | Type                        | Req. | Stamped | Meaning                                                          |
| ---------------- | --------------------------- | ---- | ------- | ---------------------------------------------------------------- |
| `schema`         | integer                     | yes  | kernel  |                                                                  |
| `ticket`         | `A-` id                     | yes  | kernel  |                                                                  |
| `target`         | string                      | yes  | kernel  |                                                                  |
| `role`           | string                      | yes  | kernel  | Role skill name (`implementer`, `verifier`, ...).                |
| `adapter`        | string                      | yes  | kernel  | The role's adapter (`role-contracts`, Role-to-adapter map).      |
| `attempt`        | integer >= 1                | yes  | kernel  |                                                                  |
| `of`             | integer >= 1                | yes  | kernel  |                                                                  |
| `scope`          | `full \| high+ \| blockers` | yes  | kernel  |                                                                  |
| `at`             | timestamp                   | yes  | kernel  |                                                                  |
| `kernel-version` | string                      | yes  | kernel  | P10.                                                             |
| `template-hash`  | hash                        | yes  | kernel  | P10.                                                             |
| `report`         | path                        | yes  | kernel  | Where the role's report is written (`reports/...`).              |
| `rules`          | array of rule ids           | yes  | kernel  | The rules selected for the ticket, in order (T31); may be empty. |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

#### Scenario: package with an unknown adapter

- **WHEN** a dispatch package carries `adapter: planner`
- **THEN** validation fails naming `adapter`

#### Scenario: package records its rules

- **WHEN** a package is built for a `runner` ticket
- **THEN** its frontmatter holds `rules: []`, and a package without `rules` fails validation naming `rules`

### Requirement: Rule file frontmatter

A rule file `.bdk/rules/<ruleId>.md` SHALL carry the frontmatter below and the rule text as its body (R-rule-id, T5, T02 decision Q-5).

| Field      | Type                                           | Req.                   | Meaning                                                                                                                                 |
| ---------- | ---------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`   | integer                                        | yes                    |                                                                                                                                         |
| `id`       | `[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[1-9][0-9]*` | yes                    | Equals the file name without `.md` (`API-4`, `BDK-SEC-2`); `BDK-` only in the bundle.                                                   |
| `kind`     | `house \| knowledge`                           | yes                    | `house`: a choice among valid alternatives; `knowledge`: a fact that corrects the model (T5, `rule-pack`, What a rule is).              |
| `applies`  | array of globs                                 | no                     | Absent: every file.                                                                                                                     |
| `roles`    | array of role names                            | no                     | Absent: every role.                                                                                                                     |
| `severity` | `critical \| high \| medium \| low`            | yes                    |                                                                                                                                         |
| `origin`   | `bdk \| import \| user \| <changeId>/<id>`     | yes                    | The shipped pack, `rules import`, `rules accept` without `--from`, or the qualified entry or attempt finding the rule was adopted from. |
| `evidence` | array of qualified ids                         | no                     | Every `--from` ref of `rules accept`.                                                                                                   |
| `since`    | date `yyyy-mm-dd`                              | yes                    |                                                                                                                                         |
| `source`   | string                                         | when `kind: knowledge` | Where the stated fact comes from (T5); unrelated to provenance `source`.                                                                |
| `verified` | date                                           | when `kind: knowledge` |                                                                                                                                         |
| `removed`  | string                                         | no                     | Tombstone reason; the id is never reused.                                                                                               |

The bundle's pack lives under `rules/` of the plugin with the same frontmatter and `origin: bdk` (`rule-pack`, Pack layout); `.bdk/rules/` holds the project's rules only. Two sessions that accept a rule with the same number in parallel create the same path; that add/add conflict is the permitted "same rule written two ways" conflict, and the later Change renumbers (numbers are never reused).

#### Scenario: knowledge rule without verification

- **WHEN** a rule has `kind: knowledge` and no `verified`
- **THEN** validation fails naming `verified`

#### Scenario: tombstone keeps its id

- **WHEN** `.bdk/rules/API-2.md` carries `removed: superseded by API-5`
- **THEN** it validates, and `rules check` counts it as a tombstone and never assigns the number 2 of `API` again

#### Scenario: adopted rule names its origin

- **WHEN** `rules accept` writes a rule with `--from 2026-09-25-passwordless-login/L-m2x9v7qa`
- **THEN** its `origin` is that ref and `evidence` lists it

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the stage of the `to` of the latest `transition` entry by `at` (two transitions of one millisecond are broken by the later stage in pipeline order, then by the greater id: `done plan-verify` and `part start` at one `at` leave the Change in `execute`), where a stage id is its own stage and a node id or instance id maps to its node's `stage` in the pipeline (`kernel-pipeline`, Pipeline file), and `intent` while the ledger holds no `transition`; the state of every graph node is derived the same way (`kernel-pipeline`, Node states); a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from the attempt records of its round, and task progress from commit trailers (`kernel-loops`); the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

In-place mutations, each by one writer: an entry's `status`, with the reason appended to its body (`log resolve`); `supersedes` of the `--by` entry when an entry is resolved as superseded (`log resolve`); an attempt record from open to close (`attempt close`, `change takeover`), and its removal by the `attempt open` that wrote it when another open ticket of the same loop and target won the race; plan part files when `part split` moves tasks and extends `depends-on`; the generated `plan/index.md` and `design/index.md`; a migration by `bdk rebuild`. Every other committed file in a Change is written once.

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

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                              | Writers                                                                                                                                                                                                   | Channel                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `change.md`                       | `change new`; `import` (each v2 design becomes a Change with `source: inferred`, through the code of `change new --inferred`)                                                                             | kernel                  |
| `log/`                            | the commands of the entry-type table                                                                                                                                                                      | kernel                  |
| `design.md`, `architecture.md`    | `design` skill                                                                                                                                                                                            | host file tools         |
| `design/parts/`                   | `design` skill                                                                                                                                                                                            | host file tools         |
| `design/index.md`                 | `done`, `rebuild`, `change takeover`                                                                                                                                                                      | kernel                  |
| `plan/parts/`                     | `plan` skill; `part split`                                                                                                                                                                                | host file tools; kernel |
| `plan/index.md`                   | `done`, `part split`, `rebuild`, `change takeover`                                                                                                                                                        | kernel                  |
| `spec-delta/`                     | `design` and `plan` skills                                                                                                                                                                                | host file tools         |
| `attempts/`                       | `attempt open`, `attempt close`, `change takeover`; `rules show --ticket` (the `rules-read` stamp); `dispatch build` (the `package` stamp)                                                                | kernel                  |
| `evidence/`                       | `evidence record`; `attempt close` (the `simplify` manifest)                                                                                                                                              | kernel                  |
| `dispatch/`                       | `dispatch build`                                                                                                                                                                                          | kernel                  |
| `reports/`                        | `log ingest` (the report of every role, on stdin, at the active package's `report` path)                                                                                                                  | kernel                  |
| any file (migration)              | `rebuild`, `change takeover`                                                                                                                                                                              | kernel                  |
| the Change directory (archive)    | `change close`, which writes `dispatch/pruned.md` and `reports/pruned.md` through the prune function unless `archive.keep-evidence`, then moves the directory to `.bdk/changes/archive/<changeId>/` (T30) | kernel                  |
| `.bdk/specs/<capability>/spec.md` | `spec merge`, `change close` (through the merge); never a host file tool (V1-7; T24 guards it)                                                                                                            | kernel                  |
| `.bdk/rules/<ruleId>.md`          | `rules accept`, `rules import`, `import`                                                                                                                                                                  | kernel                  |

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
| `learning`    | `log add` (`agent:<role>` or `kernel`); status by `log resolve`                                                                                                                                                                     |
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

#### Scenario: nested delta path

- **WHEN** a Change directory holds `spec-delta/auth/login.md`
- **THEN** reading the Change accepts it as the spec delta of capability `auth/login`, and `spec-delta/Auth_Login.md` is `state/ledger-invalid`

#### Scenario: spec-impact omitted

- **WHEN** a plan part's frontmatter has no `spec-impact` field
- **THEN** it validates against the plan part schema

### Requirement: Rebuildable index

The kernel SHALL keep a SQLite index of the project's Changes in `.bdk/.machine/index.sqlite` as a cache of the committed files (R-store), refresh it lazily before every read, and rebuild it from the files whenever it is missing, of another schema version or unreadable.

Public tables, the contract of `bdk query` (columns in camelCase are snake_case in SQL):

| Table        | One row per                              | Columns                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`    | Change directory, archived ones included | `id`, `kind`, `profile` (as in `change.md`), `source`, `intent`, `at`, `author`, `archived` (0 or 1), `dir`                                                                                                                                                                                                                             |
| `entries`    | ledger entry                             | `change_id`, `id`, `type`, `summary`, `status` (derived: `superseded` when superseded), `source`, `author`, `at`, `ticket`, `supersedes`, `superseded_by`, `review` (0 or 1), `severity`, `category`, `fingerprint`, `applies` (JSON), `evidence` (JSON), `to_stage`, `gate`, `input_hash`, `profile`, `park`, `options` (JSON), `path` |
| `refs`       | ref of an entry                          | `change_id`, `entry_id`, `position`, `ref`                                                                                                                                                                                                                                                                                              |
| `attempts`   | attempt record                           | `change_id`, `ticket`, `loop`, `target`, `attempt`, `of`, `scope`, `opened_at`, `closed_at`, `outcome`, `path`                                                                                                                                                                                                                          |
| `dispatches` | dispatch package                         | `change_id`, `ticket`, `target`, `role`, `rules` (JSON), `path`                                                                                                                                                                                                                                                                         |
| `findings`   | attempt finding                          | `change_id`, `ticket`, `position`, `fingerprint`, `type`, `file`, `symbol`                                                                                                                                                                                                                                                              |

Tables whose name starts with `_` (`_meta` with the schema version, `_files` and `_dirs` for freshness) are internal. Paths are relative to the project root. The index schema version is 5 (T21 added `input_hash`; 4 stores the normalised millisecond times; 5 adds `findings`, the rule columns of `dispatches` and drops `routed_to`, T31); any other version drops every table and rebuilds. Freshness per Change (V1-9): the modification time and file count of the Change directory and of its `log/`, `attempts/` and `dispatch/` directories; when they equal the recorded values the Change is not read at all; otherwise each file is compared by inode, modification time and size and only new or changed files are parsed and validated, removed ones deleted. A recorded directory state younger than two seconds at recording time is not trusted, so a write in the same clock tick is never missed. A refresh runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, so concurrent kernel processes serialise on it. A committed file that fails validation, or two files carrying one id, are `state/ledger-invalid` naming the files and leave the index unchanged. An index file that SQLite cannot open is deleted and rebuilt once; if that fails too, the command exits 4 with `state/corrupted-index`.

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

#### Scenario: attempt findings are indexed

- **WHEN** an attempt record holds two findings and the index is rebuilt
- **THEN** `bdk query "select fingerprint from findings"` returns their two fingerprints
