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
| `group`      | kebab-case string                                      | no   | kernel  | The review group of a `<ticket>@<group>` write (`kernel-cli`, Ticket references).        |
| `refs`       | array of refs, at least one                            | yes  |         | Files, symbols (`path#symbol`), parts, tasks, rule ids, artifact ids or (qualified) ids. |
| `supersedes` | id                                                     | no   |         | The entry this one replaces.                                                             |
| `review`     | boolean                                                | no   |         | "To be reviewed" at a gate (D3, T1).                                                     |

Types and their own fields:

| Type          | Own fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `profile` (`small \| large`, optional; written only by kernel commands that raise the profile, `change resume --profile` first; raises the effective profile)                                                                                                                                                                                                                                                                                                                                                                                                          |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories), `level` (`blocker \| should-fix \| nice-to-have \| not-a-problem`, optional; the triage level, T42-T, written only by `log triage` and by `log decide` with `fix`), `disposition` (`fix \| defer \| reject \| track`, optional; the human's decision, T42-H, written only by `log decide`), `issue` (string, optional; the tracker issue of a `track` disposition, written only by `log decide`)    |
| `observation` | `severity` (optional), `level` (`blocker \| should-fix \| nice-to-have \| not-a-problem`, optional; the triage level, T42-T, written only by `log triage` and by `log decide` with `fix`), `disposition` (`fix \| defer \| reject \| track`, optional; the human's decision, T42-H, written only by `log decide`), `issue` (string, optional; the tracker issue of a `track` disposition, written only by `log decide`)                                                                                                                                                |
| `blocker`     | `category` (optional), `level` (`blocker \| should-fix \| nice-to-have \| not-a-problem`, optional; the triage level, T42-T, written only by `log triage` and by `log decide` with `fix`), `disposition` (`fix \| defer \| reject \| track`, optional; the human's decision, T42-H, written only by `log decide`), `issue` (string, optional; the tracker issue of a `track` disposition, written only by `log decide`)                                                                                                                                                |
| `question`    | `options` (array of strings, optional), `park` (boolean, optional; written only by `change park` and by `attempt close` at the end of the ladder; marks the question that parks the Change)                                                                                                                                                                                                                                                                                                                                                                            |
| `assumption`  | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `risk`        | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `learning`    | `fingerprint` (required, kernel-stamped, see `Fingerprints`), `evidence` (array of ids of attempts or entries that support it, optional), `applies` (array of globs, optional; the files the lesson is about)                                                                                                                                                                                                                                                                                                                                                          |
| `report`      | `report` (path of the report file, required), `head` (commit sha, kernel-stamped on a `merge` report only: the commit the round reviewed, `kernel-cli/log`)                                                                                                                                                                                                                                                                                                                                                                                                            |
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

#### Scenario: level only by triage

- **WHEN** a caller tries to set `level` through `log add` or a `log ingest` block
- **THEN** no flag or field sets it, so only `log triage` writes it, and a `decision` carrying `level` fails validation naming `level`

#### Scenario: disposition only by decide

- **WHEN** a caller tries to set `disposition` or `issue` through `log add` or a `log ingest` block
- **THEN** no flag or field sets them, so only `log decide` writes them, and a `decision` carrying `disposition` fails validation naming `disposition`

#### Scenario: head only on a merge report

- **WHEN** a `report` entry without `group: merge` carries `head`
- **THEN** validation fails naming `head`

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the stage of the `to` of the latest `transition` entry by `at` (two transitions of one millisecond are broken by the later stage in pipeline order, then by the greater id: `done plan-verify` and `part start` at one `at` leave the Change in `execute`), where a stage id is its own stage and a node id or instance id maps to its node's `stage` in the pipeline (`kernel-pipeline`, Pipeline file), and `intent` while the ledger holds no `transition`; the state of every graph node is derived the same way (`kernel-pipeline`, Node states); a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from the attempt records of its round, and task progress from commit trailers (`kernel-loops`); the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

In-place mutations, each by one writer: an entry's `status`, with the reason appended to its body (`log resolve`); an entry's `level`, with the triage line appended to its body, and `status: resolved` for `not-a-problem` (`log triage`); an entry's `disposition` and `issue`, with the decision line appended to its body, `level: blocker` for `fix`, `status: accepted` for `defer` and `track` of a `proposed` entry, `status: resolved` for `reject`, and `review: true` with `--review` (`log decide`); `supersedes` of the `--by` entry when an entry is resolved as superseded (`log resolve`); an attempt record from open to close (`attempt close`, `change takeover`), and its removal by the `attempt open` that wrote it when another open ticket of the same loop and target won the race; plan part files when `part split` moves tasks and extends `depends-on`; the generated `plan/index.md` and `design/index.md`; a migration by `bdk rebuild`. Every other committed file in a Change is written once.

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

#### Scenario: triage rewrites in place

- **WHEN** `log triage` sets `level: should-fix` on a finding
- **THEN** the same entry file holds the new `level` and the triage line, and no new entry is written

#### Scenario: decide rewrites in place

- **WHEN** `log decide` sets `disposition: defer` on a `proposed` finding
- **THEN** the same entry file holds `disposition: defer`, `status: accepted` and the decision line, and no new entry is written

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `package` by every `dispatch build` without `--group` and with `rules-read` by the first `rules show --ticket` call under the implementer package, and completed by `attempt close`, with these fields.

| Field           | Type                                                                   | Req. | Stamped | Meaning                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------- | ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`        | integer                                                                | yes  | kernel  |                                                                                                                                                                             |
| `ticket`        | `A-` id                                                                | yes  | kernel  |                                                                                                                                                                             |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier \| part-lead` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).                                                                                             |
| `target`        | string                                                                 | yes  |         | Task, part, artifact or Change id.                                                                                                                                          |
| `attempt`       | integer >= 1                                                           | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                                                                                               |
| `of`            | integer >= 1                                                           | yes  | kernel  | Budget from policy.                                                                                                                                                         |
| `scope`         | `full \| high+ \| blockers`                                            | yes  |         |                                                                                                                                                                             |
| `narrowed-from` | `full \| high+ \| blockers`                                            | no   |         |                                                                                                                                                                             |
| `after`         | `A-` id                                                                | no   | kernel  | The `ok` record whose close ended the previous round of the same loop and target; every record of a round carries the same value, none in the first round (`kernel-loops`). |
| `escalation`    | boolean                                                                | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.                                                                               |
| `model`         | string                                                                 | no   | kernel  | On the escalation ticket: `policy.escalation.model` when it opened. `dispatch build` copies it into the ticket's packages (T41-D14).                                        |
| `opened-at`     | timestamp                                                              | yes  | kernel  |                                                                                                                                                                             |
| `author`        | string                                                                 | yes  | kernel  |                                                                                                                                                                             |
| `closed-at`     | timestamp                                                              | no   | kernel  | Present exactly when `outcome` is.                                                                                                                                          |
| `outcome`       | `ok \| fail \| not-run`                                                | no   |         |                                                                                                                                                                             |
| `findings`      | array of `{fingerprint, type, file, symbol?}`                          | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).                                                                                        |
| `dropped`       | array of `L-` ids                                                      | no   |         | Findings that fell out of scope N+1.                                                                                                                                        |
| `rules-read`    | timestamp                                                              | no   | kernel  | First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`.                                                                 |
| `package`       | relative path                                                          | no   | kernel  | The ticket's active package: the latest `dispatch build` of the ticket (T23-D42).                                                                                           |

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

#### Scenario: part-lead ticket

- **WHEN** an attempt record carries `loop: part-lead` and `target: 02`
- **THEN** it validates, and `bdk attempt list --for 02 --json` lists it

#### Scenario: group builds leave the active package

- **WHEN** `dispatch build <change> implementer A-r1v2w3x4` and then `dispatch build <change> reviewer A-r1v2w3x4 --group p01 --range H0..H1` run
- **THEN** the record's `package` names the implementer package

#### Scenario: after names the ok that ended the round

- **WHEN** a `review-fix` ticket closed `ok` and `bdk attempt open review-fix <change-id>` runs twice, the first new ticket closing `fail`
- **THEN** both new records carry `after` naming the `ok` ticket

### Requirement: Rebuildable index

The kernel SHALL keep a SQLite index of the project's Changes in `.bdk/.machine/index.sqlite` as a cache of the committed files (R-store), refresh it lazily before every read, and rebuild it from the files whenever it is missing, of another schema version or unreadable.

Public tables, the contract of `bdk query` (columns in camelCase are snake_case in SQL):

| Table        | One row per                              | Columns                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`    | Change directory, archived ones included | `id`, `kind`, `profile` (as in `change.md`), `source`, `intent`, `at`, `author`, `archived` (0 or 1), `dir`                                                                                                                                                                                                                                                                                                       |
| `entries`    | ledger entry                             | `change_id`, `id`, `type`, `summary`, `status` (derived: `superseded` when superseded), `source`, `author`, `at`, `ticket`, `supersedes`, `superseded_by`, `review` (0 or 1), `severity`, `category`, `fingerprint`, `applies` (JSON), `evidence` (JSON), `to_stage`, `gate`, `input_hash`, `profile`, `park`, `options` (JSON), `path`, `auto` (0 or 1), `review_group`, `level`, `head`, `disposition`, `issue` |
| `refs`       | ref of an entry                          | `change_id`, `entry_id`, `position`, `ref`                                                                                                                                                                                                                                                                                                                                                                        |
| `attempts`   | attempt record                           | `change_id`, `ticket`, `loop`, `target`, `attempt`, `of`, `scope`, `opened_at`, `closed_at`, `outcome`, `after`, `path`                                                                                                                                                                                                                                                                                           |
| `dispatches` | dispatch package                         | `change_id`, `ticket`, `target`, `role`, `rules` (JSON), `path`                                                                                                                                                                                                                                                                                                                                                   |
| `findings`   | attempt finding                          | `change_id`, `ticket`, `position`, `fingerprint`, `type`, `file`, `symbol`                                                                                                                                                                                                                                                                                                                                        |

Tables whose name starts with `_` (`_meta` with the schema version, `_files` and `_dirs` for freshness) are internal. Paths are relative to the project root. The index schema version is 8 (T21 added `input_hash`; 4 stores the normalised millisecond times; 5 adds `findings`, the rule columns of `dispatches` and drops `routed_to`, T31; 6 adds `auto` of `entries`, T41; 7 adds `review_group`, `level` and `head` of `entries`, T42; 8 adds `disposition` and `issue` of `entries` and `after` of `attempts`, T42); any other version drops every table and rebuilds. Freshness per Change (V1-9): the modification time and file count of the Change directory and of its `log/`, `attempts/` and `dispatch/` directories; when they equal the recorded values the Change is not read at all; otherwise each file is compared by inode, modification time and size and only new or changed files are parsed and validated, removed ones deleted. A recorded directory state younger than two seconds at recording time is not trusted, so a write in the same clock tick is never missed. A refresh runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, so concurrent kernel processes serialise on it. A committed file that fails validation, or two files carrying one id, are `state/ledger-invalid` naming the files and leave the index unchanged. An index file that SQLite cannot open is deleted and rebuilt once; if that fails too, the command exits 4 with `state/corrupted-index`.

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

#### Scenario: index of version 7 rebuilds

- **WHEN** `.bdk/.machine/index.sqlite` records schema version 7 and any Change-scoped command runs
- **THEN** every table is dropped and rebuilt, and `entries` holds the `disposition` and `issue` of every decided entry
