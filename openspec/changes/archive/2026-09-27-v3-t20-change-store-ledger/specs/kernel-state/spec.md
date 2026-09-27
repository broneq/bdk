# Spec Delta

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

| Type          | Own fields                                                                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `profile` (`small \| large`, optional; written only by kernel commands that raise the profile, `change resume --profile` first; raises the effective profile)                                                                                               |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories)                                                                                           |
| `observation` | `severity` (optional)                                                                                                                                                                                                                                       |
| `blocker`     | `category` (optional)                                                                                                                                                                                                                                       |
| `question`    | `options` (array of strings, optional), `park` (boolean, optional; written only by `change park`; marks the question that parks the Change)                                                                                                                 |
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

#### Scenario: park flag from log add

- **WHEN** a caller tries to write a `question` with `park: true` or a `decision` with `profile` through `log add`
- **THEN** no flag of `log add` can set either field, so only `change park` and `change resume` produce them

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the `to` of the latest `transition` entry by `at` (ties broken by the greater id), and `intent` while the ledger holds no `transition`; a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from its attempt records; the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

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

### Requirement: Two-branch merge

Two branches that work on the same Change in parallel SHALL merge without conflict, except when both edit the same rule.

#### Scenario: parallel work merges cleanly

- **WHEN** branches A and B fork from a commit holding a Change, each writes entries of several types, opens and closes attempts, records evidence, writes a dispatch package and a report, accepts a different rule and adds a delta for a different capability, and B is merged into A with `git merge`
- **THEN** the merge has no conflict and every file of the merged Change and the rules validates, with no duplicate id

#### Scenario: the same rule edited two ways

- **WHEN** both branches edit the body of the same `.bdk/rules/<ruleId>.md` differently
- **THEN** the merge conflicts on that file only

#### Scenario: merge of kernel output

- **WHEN** a Change is opened with `bdk change new` and committed, and branches A and B each write entries with `bdk log add`, resolve one with `bdk log resolve` and park or resume through `bdk change park` and `bdk change resume`, and B is merged into A with `git merge`
- **THEN** the merge has no conflict, every file of the merged Change validates, and `bdk log list --all --json` on the merged branch lists every entry of both branches exactly once

## ADDED Requirements

### Requirement: Rebuildable index

The kernel SHALL keep a SQLite index of the project's Changes in `.bdk/.machine/index.sqlite` as a cache of the committed files (R-store), refresh it lazily before every read, and rebuild it from the files whenever it is missing, of another schema version or unreadable.

Public tables, the contract of `bdk query` (columns in camelCase are snake_case in SQL):

| Table        | One row per                              | Columns                                                                                                                                                                                                                                                                                           |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changes`    | Change directory, archived ones included | `id`, `kind`, `profile` (as in `change.md`), `source`, `intent`, `at`, `author`, `archived` (0 or 1), `dir`                                                                                                                                                                                       |
| `entries`    | ledger entry                             | `change_id`, `id`, `type`, `summary`, `status` (derived: `superseded` when superseded), `source`, `author`, `at`, `ticket`, `supersedes`, `superseded_by`, `review` (0 or 1), `severity`, `category`, `fingerprint`, `routed_to`, `to_stage`, `gate`, `profile`, `park`, `options` (JSON), `path` |
| `refs`       | ref of an entry                          | `change_id`, `entry_id`, `position`, `ref`                                                                                                                                                                                                                                                        |
| `attempts`   | attempt record                           | `change_id`, `ticket`, `loop`, `target`, `attempt`, `of`, `scope`, `opened_at`, `closed_at`, `outcome`, `path`                                                                                                                                                                                    |
| `dispatches` | dispatch package                         | `change_id`, `ticket`, `target`, `role`, `path`                                                                                                                                                                                                                                                   |

Tables whose name starts with `_` (`_meta` with the schema version, `_files` and `_dirs` for freshness) are internal. Paths are relative to the project root. The index schema version is 2; any other version drops every table and rebuilds. Freshness per Change (V1-9): the modification time and file count of the Change directory and of its `log/`, `attempts/` and `dispatch/` directories; when they equal the recorded values the Change is not read at all; otherwise each file is compared by inode, modification time and size and only new or changed files are parsed and validated, removed ones deleted. A recorded directory state younger than two seconds at recording time is not trusted, so a write in the same clock tick is never missed. A refresh runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, so concurrent kernel processes serialise on it. A committed file that fails validation, or two files carrying one id, are `state/ledger-invalid` naming the files and leave the index unchanged. An index file that SQLite cannot open is deleted and rebuilt once; if that fails too, the command exits 4 with `state/corrupted-index`.

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

### Requirement: Branch binding

The kernel SHALL bind at most one Change to each local branch through a marker file `.bdk/.machine/branches/<branch>` holding the Change id, where `<branch>` is the branch name with every character outside `[A-Za-z0-9._-]` percent-encoded.

`change new` and `change resume` write the marker; `change resume` removes a marker of another branch that named the same Change, so a Change is bound to at most one branch. The markers are local machine state: a fresh clone has none and `change resume <id>` recreates the binding (S5). A marker naming an archived Change counts as no binding. The current branch is read from `HEAD` in the git directory, worktrees included; a detached `HEAD` binds nothing.

#### Scenario: branch with a slash

- **WHEN** `change new` runs on branch `feat/login`
- **THEN** the marker `.bdk/.machine/branches/feat%2Flogin` holds the Change id

#### Scenario: marker names a missing directory

- **WHEN** the marker of the current branch names a Change whose directory does not exist
- **THEN** a Change-scoped command exits 4 with `rule: state/change-dir-missing`

### Requirement: Ledger deduplication

`log add` SHALL return an existing entry instead of writing a new one when the new entry equals it by its dedupe key.

The key of a `learning` entry is its fingerprint, compared with every `learning` of the Change. The key of every other type is the type, `normalise(summary)` (`Fingerprints`), the refs as a sorted set and `supersedes`, compared only with live entries of the Change: status `proposed` or `accepted` and not superseded. A resolved finding that reappears is therefore a new entry. Entries written by the kernel itself (`change new`, `change park`, `change resume`) are never deduplicated. Two processes adding the same entry at the same moment may both write it; that duplicate is visible and harmless.

#### Scenario: resolved entry is not a duplicate

- **WHEN** a `finding` was resolved and `log add` writes the same type, summary and refs again
- **THEN** a new entry is written with `deduplicated: false`

#### Scenario: learning by fingerprint

- **WHEN** two `learning` entries differ in summary only by case, punctuation and a line number, with different refs
- **THEN** the second `log add` returns the first entry with `deduplicated: true`

### Requirement: Ignored paths

The kernel SHALL keep exactly two BDK paths out of git, `/.bdk/.machine/` and `/.bdk/settings.local.yaml`, and never ignore `.bdk/` as a whole.

Before its first write, `change new` and `config set` check both paths with `git check-ignore --no-index`; a path no rule covers (wherever the rule lives, `.git/info/exclude` included) is appended as its own line to `.gitignore` in the project root, which is created when absent. A line already present is never repeated. Without git on `PATH` the check falls back to reading `.gitignore`.

#### Scenario: fixture gitignore

- **WHEN** `bdk change new` runs in a fresh repository without `.gitignore`
- **THEN** `.gitignore` contains exactly two lines naming `.bdk` paths, `/.bdk/.machine/` and `/.bdk/settings.local.yaml`, and `git status --porcelain` lists `.bdk/changes/` as untracked

#### Scenario: idempotent

- **WHEN** `bdk change new` and `bdk config set` run again
- **THEN** `.gitignore` is unchanged
