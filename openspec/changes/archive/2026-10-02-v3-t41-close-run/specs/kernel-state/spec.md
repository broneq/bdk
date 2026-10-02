## ADDED Requirements

### Requirement: Run marker

The kernel SHALL record an active `/bdk:run` as one file per session, `.bdk/.machine/runs/<session_id>.json`, never committed, holding `schema: 1`, `session`, `prompt` (the typed command line), `auto` (true when `--auto` was the first argument token), `at` (the kernel clock) and `change-started` (false until the run's `bdk:change` call is admitted). A `session_id` that does not match `^[A-Za-z0-9_-]+$` gets no marker and its `/bdk:run` is blocked with `input/invalid-argument`. Only these writers touch it: `hooks prompt-expansion` writes it for a typed `/bdk:run` (replacing the session's earlier one) and removes it for a typed `/bdk:plan`, `/bdk:execute` or `/bdk:close` of the same session; `hooks pre-tool` sets `change-started`; `hooks session-end` removes it. A marker that does not parse counts as absent, so a model's stage skill call is denied rather than admitted. The marker is a property of a session on one machine, not of the Change: it is not part of the ledger and a second machine never sees it.

#### Scenario: marker of a typed run

- **WHEN** the user types `/bdk:run --auto "Add a notification list"` in session `S1`
- **THEN** `.bdk/.machine/runs/S1.json` validates, holds `auto: true`, `change-started: false` and the typed line as `prompt`, and `git status --porcelain` does not list it

#### Scenario: unreadable marker

- **WHEN** `.bdk/.machine/runs/S1.json` holds `{` and the main thread of `S1` calls `Skill` with `skill: bdk:execute`
- **THEN** `hooks pre-tool` denies the call with `guard/stage-skill`

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

| Type          | Own fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `profile` (`small \| large`, optional; written only by kernel commands that raise the profile, `change resume --profile` first; raises the effective profile)                                                                                                                                                                                                                                                                                                                                                                                                          |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories)                                                                                                                                                                                                                                                                                                                                                                                                      |
| `observation` | `severity` (optional)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `blocker`     | `category` (optional)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `question`    | `options` (array of strings, optional), `park` (boolean, optional; written only by `change park` and by `attempt close` at the end of the ladder; marks the question that parks the Change)                                                                                                                                                                                                                                                                                                                                                                            |
| `assumption`  | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `risk`        | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `learning`    | `fingerprint` (required, kernel-stamped, see `Fingerprints`), `evidence` (array of ids of attempts or entries that support it, optional), `applies` (array of globs, optional; the files the lesson is about)                                                                                                                                                                                                                                                                                                                                                          |
| `report`      | `report` (path of the report file, required)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `transition`  | `to` (stage, artifact id, gate id or `closed`, required), `gate` (gate id, optional), `session` (host `session_id`, optional), `command` (typed command text, optional), `skip-verify` (boolean, optional), `auto` (boolean, optional; written only by `hooks prompt-expansion` and `hooks pre-tool` for a gate a run with `--auto` passes by policy while `policy.gates.<gate>` is `manual`, T41), `input-hash` (`sha256:` hash, optional; written only by `done` and `part done` for the node named in `to`, P2; a transition carrying it is the node's done marker) |

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

### Requirement: Rebuildable index

The kernel SHALL keep a SQLite index of the project's Changes in `.bdk/.machine/index.sqlite` as a cache of the committed files (R-store), refresh it lazily before every read, and rebuild it from the files whenever it is missing, of another schema version or unreadable.

Public tables, the contract of `bdk query` (columns in camelCase are snake_case in SQL):

| Table        | One row per                              | Columns                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`    | Change directory, archived ones included | `id`, `kind`, `profile` (as in `change.md`), `source`, `intent`, `at`, `author`, `archived` (0 or 1), `dir`                                                                                                                                                                                                                                              |
| `entries`    | ledger entry                             | `change_id`, `id`, `type`, `summary`, `status` (derived: `superseded` when superseded), `source`, `author`, `at`, `ticket`, `supersedes`, `superseded_by`, `review` (0 or 1), `severity`, `category`, `fingerprint`, `applies` (JSON), `evidence` (JSON), `to_stage`, `gate`, `input_hash`, `profile`, `park`, `options` (JSON), `path`, `auto` (0 or 1) |
| `refs`       | ref of an entry                          | `change_id`, `entry_id`, `position`, `ref`                                                                                                                                                                                                                                                                                                               |
| `attempts`   | attempt record                           | `change_id`, `ticket`, `loop`, `target`, `attempt`, `of`, `scope`, `opened_at`, `closed_at`, `outcome`, `path`                                                                                                                                                                                                                                           |
| `dispatches` | dispatch package                         | `change_id`, `ticket`, `target`, `role`, `rules` (JSON), `path`                                                                                                                                                                                                                                                                                          |
| `findings`   | attempt finding                          | `change_id`, `ticket`, `position`, `fingerprint`, `type`, `file`, `symbol`                                                                                                                                                                                                                                                                               |

Tables whose name starts with `_` (`_meta` with the schema version, `_files` and `_dirs` for freshness) are internal. Paths are relative to the project root. The index schema version is 6 (T21 added `input_hash`; 4 stores the normalised millisecond times; 5 adds `findings`, the rule columns of `dispatches` and drops `routed_to`, T31; 6 adds `auto` of `entries`, T41); any other version drops every table and rebuilds. Freshness per Change (V1-9): the modification time and file count of the Change directory and of its `log/`, `attempts/` and `dispatch/` directories; when they equal the recorded values the Change is not read at all; otherwise each file is compared by inode, modification time and size and only new or changed files are parsed and validated, removed ones deleted. A recorded directory state younger than two seconds at recording time is not trusted, so a write in the same clock tick is never missed. A refresh runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, so concurrent kernel processes serialise on it. A committed file that fails validation, or two files carrying one id, are `state/ledger-invalid` naming the files and leave the index unchanged. An index file that SQLite cannot open is deleted and rebuilt once; if that fails too, the command exits 4 with `state/corrupted-index`.

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

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                              | Writers                                                                                                                                                                                                   | Channel                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `change.md`                       | `change new`                                                                                                                                                                                              | kernel                  |
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
| `.bdk/rules/<ruleId>.md`          | `rules accept`, `rules import`                                                                                                                                                                            | kernel                  |

Entry types (`source` values each writer stamps):

| Type          | Writers and `source`                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `log add` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split`, `done` for the profile raise of a split design (`kernel`)                                                                                                                                                                             |
| `finding`     | `log add`; `attempt close` and `commit` for undeclared files, `attempt close` for an implementer that read no rules, `attempt open` for dropped findings, `commit` and `part done` for the tiny guard, `hooks stop` and `hooks subagent-stop` for a thread that stopped with work open (`kernel`)                                                 |
| `observation` | `log add` (including a downgraded uncategorised verifier blocker, P8)                                                                                                                                                                                                                                                                             |
| `blocker`     | `log add`                                                                                                                                                                                                                                                                                                                                         |
| `question`    | `log add`; `change park` and `attempt close` at the end of the ladder (`kernel`, with `park: true`)                                                                                                                                                                                                                                               |
| `assumption`  | `log add`; `change new` for the proposed profile (`kernel`)                                                                                                                                                                                                                                                                                       |
| `risk`        | `log add`                                                                                                                                                                                                                                                                                                                                         |
| `learning`    | `log add` (`agent:<role>` or `kernel`); status by `log resolve`                                                                                                                                                                                                                                                                                   |
| `report`      | `log add`                                                                                                                                                                                                                                                                                                                                         |
| `transition`  | `hooks prompt-expansion` (`user` for a typed stage command, `policy` for an auto gate, `kernel` for a stage without a gate); `hooks pre-tool` for a stage skill a run starts (`policy` for its gate, `kernel` for a stage without a gate); `done`, `part start` (without `input-hash`), `part done`, `change takeover`, `change close` (`kernel`) |

Rules without exception: `intent` lives only in `change.md`, written only by `change new`; a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `log add` never writes `transition`, `log ingest` writes no entry at all, and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

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

#### Scenario: a run's gate is written by the pre-tool hook

- **WHEN** the write map contract test reads the record of `hooks pre-tool`
- **THEN** its `writes[]` holds `.bdk/changes/<id>/log/` and the entry-type table names it as a writer of `transition` with `policy` and `kernel`
