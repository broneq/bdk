# kernel-state Specification

## Purpose

The state contract of BDK v3: the Change directory, the schema of every document the kernel writes or validates in it and of rule files, the id, fingerprint and versioning rules, the write map naming a writer for every file and entry type, and the guarantee that two branches of one Change merge without conflict.

## Requirements

### Requirement: Change directory layout

A Change SHALL live in `.bdk/changes/<changeId>/` with exactly the paths below; every per-object file name SHALL carry the object's id or ticket so that two branches never create the same path.

The Change id is `<yyyy-mm-dd>-<slug>`: the kernel clock's UTC date at `change new` and a kebab-case slug of the intent (at most 40 characters). `change new` refuses when the directory exists.

| Path                                      | Document          | Committed | Note                                                                                                |
| ----------------------------------------- | ----------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `change.md`                               | change            | yes       | Written once.                                                                                       |
| `log/<ts>-<type>-<id>.md`                 | entry             | yes       | One file per ledger entry (K4); `<ts>` is `at` to the second as `yyyymmddThhmmssZ`.                 |
| `design.md`                               | design artifact   | yes       | Profiles without design parts.                                                                      |
| `architecture.md`                         | design artifact   | yes       | T02 decision R-5.                                                                                   |
| `design/parts/<nn>-<slug>.md`             | design part       | yes       | `large` profile (R-4).                                                                              |
| `design/index.md`                         | design index      | yes       | Generated from the design parts.                                                                    |
| `plan/parts/<nn>-<slug>.md`               | plan part         | yes       |                                                                                                     |
| `plan/index.md`                           | plan index        | yes       | Generated from the plan parts.                                                                      |
| `spec-delta/<capability>.md`              | spec delta        | yes       | Spec delta grammar (T30); nested by capability path; no `schema` field, no file in `schema/state/`. |
| `attempts/<loop>-<target>-<ticket>.md`    | attempt           | yes       | One file per ticket (replaces the design's append-only `<loop>-<target>.md`).                       |
| `evidence/<target>-<evidenceId>.md`       | evidence manifest | yes       | Captures above `policy.evidence.max-committed-bytes` or not text live in `.bdk/.machine/evidence/`. |
| `evidence/<target>-<evidenceId>-<name>`   | evidence capture  | yes       | A file its manifest lists with `stored: committed`, under its own file name; not schema-checked.    |
| `dispatch/<target>-<role>-<ticket>.md`    | dispatch package  | yes       | The design's attempt number `<n>` becomes the ticket.                                               |
| `reports/<target>-<role>-<ticket>.md`     | report            | yes       |                                                                                                     |
| `dispatch/pruned.md`, `reports/pruned.md` | pruned index      | yes       | Archived Change only: replaces the directory's other files (Pruned index).                          |

`<target>` is a task id (`02-3`), a part id (`02`), an artifact id or the Change id, the same value as the attempt's `target`. Rule files live outside the Change as `.bdk/rules/<ruleId>.md` (T02 decision Q-5). `<capability>` is a capability path, one or more kebab-case segments joined by `/` (`auth/login`), so the delta of `auth/login` is `spec-delta/auth/login.md`, mirroring `.bdk/specs/auth/login/spec.md` (`Living spec file`). Nothing else is created in a Change directory; `change close` moves it to `.bdk/changes/archive/<changeId>/` (T30), where it keeps the same layout.

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

| Field        | Type                       | Req. | Stamped | Meaning                                                                                                 |
| ------------ | -------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------- |
| `schema`     | integer                    | yes  | kernel  | Document version.                                                                                       |
| `id`         | Change id                  | yes  | kernel  |                                                                                                         |
| `kind`       | `feature \| bug \| review` | yes  |         | Graph variant (T02 decision R-8); `review` for a review of work already on the branch (T42).            |
| `profile`    | `tiny \| small \| large`   | yes  |         | Profile at opening; a later raise is a ledger entry, never an edit.                                     |
| `intent`     | string                     | yes  |         | The intent (for `bug`, the reproduction). The only place the intent lives (R-12).                       |
| `source`     | `user \| inferred`         | yes  | kernel  | `inferred` only from `change new --inferred` (R-12).                                                    |
| `at`         | timestamp                  | yes  | kernel  |                                                                                                         |
| `author`     | string                     | yes  | kernel  | Git `user.name <user.email>`.                                                                           |
| `overridden` | array of key names         | yes  | kernel  | Settings keys the local layer overrides at opening, names only (D4b); empty when none.                  |
| `base`       | commit sha                 | no   | kernel  | Only for `kind: review`: `git merge-base HEAD <ref>` at opening, where the Change's range starts (T42). |

The body is empty.

#### Scenario: inferred Change

- **WHEN** a stage skill without an active Change calls `change new --inferred "<first sentence>"`
- **THEN** `change.md` carries `source: inferred` and no later command rewrites the file

#### Scenario: review Change carries its base

- **WHEN** `bdk change new "Review the login branch" --kind review --base main` runs
- **THEN** `change.md` carries `kind: review` and `base` equal to `git merge-base HEAD main`, and a `feature` or `bug` Change carries no `base`

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

- **WHEN** `attempt close` ends the ladder of `part 02`
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

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `package` by every `dispatch build` without `--group` and with `rules-read` by the first `rules show --ticket` call under the implementer package, and completed by `attempt close`, with these fields.

| Field           | Type                                           | Req. | Stamped | Meaning                                                                                                                                                                                                                           |
| --------------- | ---------------------------------------------- | ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`        | integer                                        | yes  | kernel  |                                                                                                                                                                                                                                   |
| `ticket`        | `A-` id                                        | yes  | kernel  |                                                                                                                                                                                                                                   |
| `loop`          | `part \| verify-fix \| review-fix \| verifier` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).                                                                                                                                                   |
| `target`        | string                                         | yes  |         | Part, artifact or Change id; never a task id (#166).                                                                                                                                                                              |
| `attempt`       | integer >= 1                                   | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                                                                                                                                                     |
| `of`            | integer >= 1                                   | yes  | kernel  | Budget from policy.                                                                                                                                                                                                               |
| `scope`         | `full \| high+ \| blockers`                    | yes  |         |                                                                                                                                                                                                                                   |
| `narrowed-from` | `full \| high+ \| blockers`                    | no   |         |                                                                                                                                                                                                                                   |
| `after`         | `A-` id                                        | no   | kernel  | The `ok` record whose close ended the previous round of the same loop and target; every record of a round carries the same value, none in the first round (`kernel-loops`).                                                       |
| `escalation`    | boolean                                        | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.                                                                                                                                     |
| `model`         | string                                         | no   | kernel  | On the escalation ticket: `policy.escalation.model` when it opened. `dispatch build` copies it into the ticket's packages (T41-D14).                                                                                              |
| `opened-at`     | timestamp                                      | yes  | kernel  |                                                                                                                                                                                                                                   |
| `author`        | string                                         | yes  | kernel  |                                                                                                                                                                                                                                   |
| `closed-at`     | timestamp                                      | no   | kernel  | Present exactly when `outcome` is.                                                                                                                                                                                                |
| `outcome`       | `ok \| fail \| not-run`                        | no   |         |                                                                                                                                                                                                                                   |
| `findings`      | array of `{fingerprint, type, file, symbol?}`  | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).                                                                                                                                              |
| `dropped`       | array of `L-` ids                              | no   |         | Findings that fell out of scope N+1.                                                                                                                                                                                              |
| `rules-read`    | timestamp                                      | no   | kernel  | First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`.                                                                                                                       |
| `package`       | relative path                                  | no   | kernel  | The ticket's active package: the latest `dispatch build` (T23-D42); a working agent's package wins (`kernel-cli`, Ticket references).                                                                                             |
| `merge`         | boolean                                        | no   | kernel  | A `verify-fix` merge ticket of a worktree part (T45; `kernel-cli/attempt`, bdk attempt open).                                                                                                                                     |
| `conflicts`     | array of paths                                 | no   | kernel  | The unmerged paths when the merge ticket opened; present exactly when `merge` is.                                                                                                                                                 |
| `base`          | commit id                                      | no   | kernel  | On a `part` or `verify-fix` record: the full id of the commit `HEAD` of the part's work root pointed at when the ticket opened; the diff check of its close reads the part's commits after it (`kernel-loops`, Diff check; #166). |

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

- **WHEN** `dispatch build 02 implementer A-7f3k9m2q` and then `dispatch build 02 conformer A-7f3k9m2q` run
- **THEN** the record's `package` is `dispatch/02-conformer-A-7f3k9m2q.md`

#### Scenario: part ticket

- **WHEN** an attempt record carries `loop: part`, `target: 02` and `base`
- **THEN** it validates, and `bdk attempt list --for 02 --json` lists it

#### Scenario: removed loop names

- **WHEN** an attempt record carries `loop: task-redispatch` or `loop: part-lead`
- **THEN** reading the Change reports `state/ledger-invalid` naming `loop`

#### Scenario: group builds leave the active package

- **WHEN** `dispatch build <change> implementer A-r1v2w3x4` and then `dispatch build <change> reviewer A-r1v2w3x4 --group p01 --range H0..H1` run
- **THEN** the record's `package` names the implementer package

#### Scenario: after names the ok that ended the round

- **WHEN** a `review-fix` ticket closed `ok` and `bdk attempt open review-fix <change-id>` runs twice, the first new ticket closing `fail`
- **THEN** both new records carry `after` naming the `ok` ticket

#### Scenario: part-lead ticket

- **WHEN** an attempt record carries `loop: part-lead` and `target: 02`
- **THEN** reading the Change reports `state/ledger-invalid` naming `loop`

### Requirement: Evidence manifest

An evidence manifest SHALL record one verification artifact with the working-tree hash of its target at capture (T4, P5), and a manifest SHALL be fresh exactly when that hash equals the current tree hash of its target.

| Field       | Type                                                        | Req. | Stamped | Meaning                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------- | ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`    | integer                                                     | yes  | kernel  |                                                                                                                                                                                                |
| `id`        | `E-` id                                                     | yes  | kernel  |                                                                                                                                                                                                |
| `kind`      | string                                                      | yes  |         | `conform`, `tests-scoped`, `lint`, `tests-full`, `lint-full`, `coverage`, `typecheck`, `ui-capture` or a project kind.                                                                         |
| `ticket`    | `A-` id                                                     | yes  |         |                                                                                                                                                                                                |
| `group`     | kebab-case string                                           | no   | kernel  | The review group of a `<ticket>@<group>` record.                                                                                                                                               |
| `tool`      | string                                                      | no   | kernel  | Only on `coverage`: the `tools.test` id measured.                                                                                                                                              |
| `target`    | string                                                      | yes  | kernel  | From the ticket.                                                                                                                                                                               |
| `at`        | timestamp                                                   | yes  | kernel  |                                                                                                                                                                                                |
| `author`    | string                                                      | yes  | kernel  |                                                                                                                                                                                                |
| `source`    | `agent:<role> \| kernel`                                    | yes  | kernel  | The role of the ticket's active package; `kernel` without one, for the `conform` manifest `attempt close` records, and for the `tests-scoped` and `lint` manifests `check run` records (#166). |
| `tree-hash` | hash                                                        | yes  | kernel  |                                                                                                                                                                                                |
| `tree`      | array of `{path, hash}`                                     | yes  | kernel  | The files the tree hash covers, each with its `sha256:` hash or `absent`; `evidence check` names the paths that differ.                                                                        |
| `files`     | array of `{path, hash, stored: committed \| machine}`, >= 1 | yes  | kernel  |                                                                                                                                                                                                |
| `verdict`   | `pass \| fail \| not-run`                                   | no   |         |                                                                                                                                                                                                |
| `citations` | array of strings                                            | no   |         | JSON pointers or snapshot lines (citation validator).                                                                                                                                          |

Tree hash (T23-D7, D16, D45): the scope of a target is its part for a task, the part itself, and every part for the Change. The covered files are the `Files:` paths of every task in the scope that do not match `policy.evidence.non-executable`, plus every file of the working tree (tracked or untracked and not ignored) matching `policy.evidence.build-config`; a path matching `build-config` is always covered. The tree hash is `sha256:` over the covered paths in byte order, each contributing its path, a NUL byte, its file hash (`sha256:` of its bytes) or the marker `absent` when the file does not exist, and a NUL byte, so a rename, a deletion and a new build-config file change it. `tree` lists the same paths with each file's hash. The same function serves `evidence record`, `evidence check`, `attempt close` and the post-task step nodes (`kernel-pipeline`, Artifact kinds), and `check run`, which hashes the scope of its own target, a task or a part.

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

#### Scenario: coverage names its tool

- **WHEN** a `coverage` manifest has no `tool`
- **THEN** validation fails naming `tool`

### Requirement: Dispatch package

A dispatch package SHALL be written only by `dispatch build`, with the frontmatter fields below (K3, K4, P10) and the body sections that `kernel-cli/dispatch`, `bdk dispatch build`, lists in order; the whole file is at most 163 840 bytes (`policy/package-too-large`).

| Field            | Type                        | Req. | Stamped | Meaning                                                                                                                                                      |
| ---------------- | --------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`         | integer                     | yes  | kernel  |                                                                                                                                                              |
| `ticket`         | `A-` id                     | yes  | kernel  |                                                                                                                                                              |
| `target`         | string                      | yes  | kernel  |                                                                                                                                                              |
| `role`           | string                      | yes  | kernel  | Role skill name (`implementer`, `verifier`, ...).                                                                                                            |
| `adapter`        | string                      | yes  | kernel  | The role's adapter (`role-contracts`, Role-to-adapter map).                                                                                                  |
| `attempt`        | integer >= 1                | yes  | kernel  |                                                                                                                                                              |
| `of`             | integer >= 1                | yes  | kernel  |                                                                                                                                                              |
| `scope`          | `full \| high+ \| blockers` | yes  | kernel  |                                                                                                                                                              |
| `model`          | string                      | no   | kernel  | The escalation ticket's `model`, on every package of the ticket but a `runner` or `scout` one; the agent must run on it (T41-D14, `guard/escalation-model`). |
| `at`             | timestamp                   | yes  | kernel  |                                                                                                                                                              |
| `kernel-version` | string                      | yes  | kernel  | P10.                                                                                                                                                         |
| `template-hash`  | hash                        | yes  | kernel  | P10.                                                                                                                                                         |
| `report`         | path                        | yes  | kernel  | Where the role's report is written (`reports/...`).                                                                                                          |
| `draft`          | path                        | yes  | kernel  | Where the agent writes its report before `log ingest --file`: `.bdk/.machine/drafts/<package file name>` (#166).                                             |
| `rules`          | array of rule ids           | yes  | kernel  | The rules selected for the ticket, in order (T31); may be empty.                                                                                             |
| `group`          | kebab-case string           | no   | kernel  | Review group of a `dispatch build --group` package (T42-A1).                                                                                                 |
| `files`          | array of paths              | no   | kernel  | The group's file set; present exactly when `group` is.                                                                                                       |
| `workdir`        | absolute path               | no   | kernel  | The work root of the target when it is a live worktree part, or a task of one (Part worktree, T45); absent otherwise, which means the home checkout.         |
| `entries`        | array of ledger ids         | no   | kernel  | The entries a `judge` package lists to triage, in package order; present exactly on a `judge` package. `guard/judge-scope` reads it (#158).                  |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

#### Scenario: package with an unknown adapter

- **WHEN** a dispatch package carries `adapter: planner`
- **THEN** validation fails naming `adapter`

#### Scenario: escalation package names its model

- **WHEN** `dispatch build` builds the `implementer` and the `conformer` package of an escalation ticket of `part 02` opened with `policy.escalation.model: opus`
- **THEN** both packages hold `model: opus`

#### Scenario: package records its rules

- **WHEN** a gate `runner` package is built for a review round
- **THEN** its frontmatter holds `rules: []`, and a package without `rules` fails validation naming `rules`

#### Scenario: group without files

- **WHEN** a dispatch package carries `group: p01` and no `files`
- **THEN** validation fails naming `files`

#### Scenario: relative workdir

- **WHEN** a dispatch package carries `workdir: .bdk/.machine/worktrees/x/02`
- **THEN** validation fails naming `workdir`, because it must be absolute

#### Scenario: judge package names its entries

- **WHEN** `dispatch build <change> judge A-r1v2w3x4 --group judge --range H0..H1` lists `L-a1` and `L-c3` in its `Review` section
- **THEN** its frontmatter holds `entries: [L-a1, L-c3]`, and a package of any other role holds no `entries`

#### Scenario: package names its draft

- **WHEN** `dispatch build 02 implementer A-7f3k9m2q` runs
- **THEN** the frontmatter holds `draft: .bdk/.machine/drafts/02-implementer-A-7f3k9m2q.md`, and a package without `draft` fails validation naming `draft`

### Requirement: Report envelope

A report's frontmatter SHALL be the role's envelope (at most 15 rendered lines) and its body SHALL be the full report. `log ingest` writes every report, stamping `schema`, `ticket`, `role` and `at`; a role writes only the other fields and never a `bdk-entries` block (T23-D14).

| Field      | Type                                                     | Req. | Meaning                                                                                  |
| ---------- | -------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `schema`   | integer                                                  | yes  | Stamped by `log ingest`.                                                                 |
| `ticket`   | `A-` id                                                  | yes  | Stamped by `log ingest` from `--ticket`.                                                 |
| `group`    | kebab-case string                                        | no   | Stamped by `log ingest` for a `<ticket>@<group>` report.                                 |
| `role`     | string                                                   | yes  | Stamped by `log ingest` from the dispatch package; `orchestrator` for the `merge` group. |
| `at`       | timestamp                                                | no   | Stamped by `log ingest`; absent on reports of earlier kernels.                           |
| `status`   | `done \| done-with-concerns \| needs-context \| blocked` | yes  | The four statuses of the v2 return contract.                                             |
| `files`    | array of paths                                           | yes  | Files the role changed; empty for read-only roles.                                       |
| `entries`  | array of `L-` ids                                        | yes  | Entries the role wrote with `log add`; empty when none.                                  |
| `evidence` | array of `E-` ids                                        | yes  | Manifests the role recorded; empty when none.                                            |
| `reason`   | string                                                   | no   | Required for `blocked` and `needs-context`.                                              |

#### Scenario: blocked without reason

- **WHEN** a report has `status: blocked` and no `reason`
- **THEN** validation fails naming `reason`

#### Scenario: merge report envelope

- **WHEN** `log ingest --ticket A-r1v2w3x4@merge` stores a report
- **THEN** its frontmatter holds `role: orchestrator` and `group: merge`

### Requirement: Plan part and plan index

A plan part's frontmatter SHALL carry the part fields of P6 and P7, and `plan/index.md` SHALL be generated from the parts only.

Plan part (`plan/parts/<nn>-<slug>.md`; the task grammar of the body follows the table):

| Field              | Type                                | Req. | Meaning                                                                                                                                                                                         |
| ------------------ | ----------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | integer                             | yes  |                                                                                                                                                                                                 |
| `id`               | two digits                          | yes  | Equals `<nn>` of the file name.                                                                                                                                                                 |
| `title`            | string                              | yes  |                                                                                                                                                                                                 |
| `goal`             | string                              | yes  |                                                                                                                                                                                                 |
| `success-measure`  | string                              | yes  | What a reviewer can observe.                                                                                                                                                                    |
| `do-not-touch`     | array of globs                      | yes  | Empty allowed.                                                                                                                                                                                  |
| `depends-on`       | array of part ids                   | yes  | Empty allowed.                                                                                                                                                                                  |
| `spec-impact`      | `none` or array of capability names | no   | D2; absent means `none` for `tiny` and `small`, and fails the plan part check for `large` (`kernel-loops`, Plan part checks).                                                                   |
| `isolation`        | `shared` or `worktree`              | no   | Where the part runs (T45): `shared`, the default when absent, in the Change's working tree; `worktree` in its own git worktree (Part worktree).                                                 |
| `isolation-reason` | string                              | no   | One line naming the state the part shares outside `Files:` (a lockfile, codegen output, migration numbering, a port, a database); required when `isolation` is `worktree`. An executable field. |

The body holds the part's tasks. A task starts at a level-2 heading `## <task-id> <title>`, where `<task-id>` is two digits, a dash and a positive integer (`02-3`) and ends at the next level-2 heading. Task ids are unique across the plan; `plan` writes them with the part's prefix and `part split` keeps a moved task's id. Under a task heading the kernel reads these bold field labels; other text is free:

| Label               | Req.           | Value                                                                                                                    |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `**Files:**`        | yes            | A list; each item holds one backticked relative path, optionally prefixed by `Create:`, `Modify:`, `Test:` or `Delete:`. |
| `**Test cases:**`   | one of the two | A non-empty list of test cases.                                                                                          |
| `**Verification:**` | one of the two | `none`: the `Verification: none` task class (below).                                                                     |
| `**Depends on:**`   | no             | `none` or comma-separated task ids of the same part.                                                                     |
| `**Stop rule:**`    | no             | The condition under which the worker stops and returns `blocked` (P6).                                                   |

A task MAY declare `Verification: none` only when every file of its `**Files:**` is non-executable content (a path in `policy.evidence.non-executable` and not in `policy.evidence.build-config`, `kernel-settings`, Keys of evidence policy), pure wiring, or a refactor fully covered by existing tests. Such a task has no `**Test cases:**`, is not run test-first, and is verified by its success measure and the review at the end of the plan.

Executable fields are `goal`, `success-measure`, `isolation-reason`, each task title, each `Files:` item, each `Test cases:` item and `Stop rule:`. An executable field holds a placeholder when it contains `TODO`, `TBD` or `FIXME` as a word, `<fill in>` or `[...]`, is `...` or `…` alone, or is wrapped in square brackets as a whole (`[Action verb + what]`).

Plan index: `schema`, `generated: true`, `parts` (array of `{id, title, depends-on, wave}`), where `wave` is 1 for a part without dependencies and one more than the highest wave of its dependencies. The body is a rendered table. The index is a pure function of the parts: regenerating it from unchanged parts yields the same bytes; a dependency cycle or a missing part id fails generation.

#### Scenario: regenerated index

- **WHEN** `plan/index.md` is deleted and regenerated from unchanged parts
- **THEN** its bytes equal the deleted file

#### Scenario: dependency cycle

- **WHEN** part `01` depends on `02` and `02` on `01`
- **THEN** generation fails naming both parts

#### Scenario: task grammar

- **WHEN** a part body holds `## 02-1 Add login route` with a `**Files:**` list of two backticked paths and a `**Test cases:**` list, and `## 02-2 Wire config` with `**Files:**` and `**Verification:** none`
- **THEN** the part parses into two tasks with their files, the first with test cases and the second with verification `none`

#### Scenario: placeholder title

- **WHEN** a task heading reads `## 02-1 [Action verb + what]`
- **THEN** the task title holds a placeholder

#### Scenario: isolation absent

- **WHEN** a part's frontmatter has no `isolation` field
- **THEN** the part parses with `isolation: shared` and no `isolation-reason`

#### Scenario: worktree part

- **WHEN** a part's frontmatter sets `isolation: worktree` and `isolation-reason: "both parts regenerate pnpm-lock.yaml"`
- **THEN** the part parses with both fields, and `isolation: sandbox` fails validation naming `isolation`

### Requirement: Design artifacts and design index

`design.md`, `architecture.md` and design parts SHALL carry frontmatter, and `design/index.md` SHALL be generated from the design parts only.

`design.md` and `architecture.md`: `schema`, `title`; `design.md` also carries the optional boolean `architecture` (default `true`), which the `design` skill sets to `false` for a product-only Change so the `architecture` node is skipped (T02 decision R-5, `kernel-pipeline`, Artifact kinds). Design part (`design/parts/<nn>-<slug>.md`): `schema`, `id` (two digits, equal to `<nn>`), `title`, `depends-on` (array of design part ids). Design index: `schema`, `generated: true`, `parts` (array of `{id, title, depends-on}`), same determinism and cycle rule as the plan index.

#### Scenario: design without frontmatter

- **WHEN** `bdk done design` runs on a `design.md` without `schema`
- **THEN** the exit code is 2 with `rule: policy/validation-failed` naming `schema`

#### Scenario: product-only design

- **WHEN** `design.md` carries `architecture: false`
- **THEN** it validates, and a `design.md` carrying `architecture: "no"` fails naming `architecture`

### Requirement: Rule file frontmatter

A rule file `.bdk/rules/<ruleId>.md` SHALL carry the frontmatter below and the rule text as its body (R-rule-id, T5, T02 decision Q-5).

| Field      | Type                                                            | Req.                   | Meaning                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`   | integer                                                         | yes                    |                                                                                                                                                                                                 |
| `id`       | `[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[1-9][0-9]*`                  | yes                    | Equals the file name without `.md` (`API-4`, `BDK-SEC-2`); `BDK-` only in the bundle.                                                                                                           |
| `kind`     | `house \| knowledge`                                            | yes                    | `house`: a choice among valid alternatives; `knowledge`: a fact that corrects the model (T5, `rule-pack`, What a rule is).                                                                      |
| `paths`    | non-empty array of globs                                        | yes                    | The files the rule governs; `**` names every file. Matched against the target's files, or against the work tree files when the target has none (`kernel-cli/rules`, bdk rules show, Selection). |
| `stages`   | non-empty array of unique `design \| plan \| execute \| review` | yes                    | The pipeline stages whose readers get the rule (`kernel-cli/rules`, Stage readers); no wildcard.                                                                                                |
| `severity` | `critical \| high \| medium \| low`                             | yes                    |                                                                                                                                                                                                 |
| `origin`   | `bdk \| user \| <changeId>/<id>`                                | yes                    | The shipped pack, `rules accept` without `--from`, or the qualified entry or attempt finding the rule was adopted from.                                                                         |
| `evidence` | array of qualified ids                                          | no                     | Every `--from` ref of `rules accept`.                                                                                                                                                           |
| `since`    | date `yyyy-mm-dd`                                               | yes                    |                                                                                                                                                                                                 |
| `source`   | string                                                          | when `kind: knowledge` | Where the stated fact comes from (T5); unrelated to provenance `source`.                                                                                                                        |
| `verified` | date                                                            | when `kind: knowledge` |                                                                                                                                                                                                 |
| `removed`  | string                                                          | no                     | Tombstone reason; the id is never reused.                                                                                                                                                       |

Both `paths` and `stages` are stated in every rule: a rule is never global or read by every stage because a field was left out. A rule file that carries `applies` or `roles` fails validation naming the field, with no migration (v3 is unreleased).

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

#### Scenario: origin import is refused

- **WHEN** `.bdk/rules/API-1.md` carries `origin: import` and `bdk rules check` runs
- **THEN** validation fails naming `origin`, and the exit code is 2 with `rule: policy/rule-format`

#### Scenario: rule without stages

- **WHEN** `.bdk/rules/API-1.md` carries `paths: ["src/api/**"]` and no `stages`, and `bdk rules check` runs
- **THEN** validation fails naming `stages`, and the exit code is 2 with `rule: policy/rule-format`

#### Scenario: old field names are refused

- **WHEN** `.bdk/rules/API-1.md` carries `applies: ["src/api/**"]` or `roles: [reviewer]` and `bdk rules check` runs
- **THEN** validation fails naming `applies` or `roles`, and the exit code is 2 with `rule: policy/rule-format`

#### Scenario: a rule for every file and every stage

- **WHEN** a rule carries `paths: ["**"]` and `stages: [design, plan, execute, review]`
- **THEN** it validates, and `stages: ["*"]` or `stages: []` fails naming `stages`

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
| `evidence/`                       | `evidence record`, `evidence coverage`, `check run` (the `tests-scoped` and `lint` manifests); `attempt close` (the `conform` manifest)                                                                   | kernel                  |
| `dispatch/`                       | `dispatch build`                                                                                                                                                                                          | kernel                  |
| `reports/`                        | `log ingest` (the report of every role, read from `--file`, at the active or group package's `report` path, and the merged review of the `merge` group)                                                   | kernel                  |
| any file (migration)              | `rebuild`, `change takeover`                                                                                                                                                                              | kernel                  |
| the Change directory (archive)    | `change close`, which writes `dispatch/pruned.md` and `reports/pruned.md` through the prune function unless `archive.keep-evidence`, then moves the directory to `.bdk/changes/archive/<changeId>/` (T30) | kernel                  |
| `.bdk/specs/<capability>/spec.md` | `spec merge`, `change close` (through the merge); never a host file tool (V1-7; T24 guards it)                                                                                                            | kernel                  |
| `.bdk/rules/<ruleId>.md`          | `rules accept`                                                                                                                                                                                            | kernel                  |

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

Rules without exception: `intent` lives only in `change.md`, written only by `change new`; a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `level` of a `finding`, `blocker` or `observation` is written only by `log triage`, and `head` of a `report` only by `log add` under the `merge` group. `log add` never writes `transition`, `log ingest` writes no entry at all, and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

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

### Requirement: Write map enforcement

The kernel SHALL enforce the write map for every file a kernel command writes, and contract tests SHALL enforce the map against the CLI contract; files written through host file tools SHALL be validated at `done`.

Kernel-enforced: only `shared/store` builds Change paths and writes them; schema validation on write and read; kernel-stamped fields are never taken from input (`input/forbidden-field`); availability classes keep subagents off orchestrator commands (`hooks pre-tool`, T24). Contract-enforced: every kernel writer in the tables is a command of `schema/cli/commands.json` whose availability is `orchestrator`, `agent` or `hook` (never `read`) and whose `writes[]` covers the path; every Change path in any command's `writes[]` appears in the file table. Documented and validated at `done`: files written through host file tools (design and plan artifacts, `spec-delta/`); the kernel cannot see their writer, and whether `hooks pre-tool` denies host-tool writes into kernel-channel paths is T24's decision.

#### Scenario: writer is a read command

- **WHEN** the file table names a command whose availability is `read`
- **THEN** the write map contract test fails naming the command

#### Scenario: undeclared write

- **WHEN** a command's `writes[]` lists a Change path that the file table does not name it for
- **THEN** the write map contract test fails naming the command and the path

### Requirement: State JSON Schema

The JSON Schema of every document kind SHALL be generated from the zod schemas into `schema/state/<kind>.json` by `pnpm build`, and the field tables of this spec SHALL equal the generated schemas.

Files: `change.json`, `entry.json`, `attempt.json`, `evidence.json`, `dispatch.json`, `report.json`, `pruned.json`, `plan-part.json`, `plan-index.json`, `design.json`, `design-part.json`, `design-index.json`, `rule.json`, and `common.json` for the shared definitions (ids, refs, hashes, timestamps). Each file is draft 2020-12 with `$id` under `https://raw.githubusercontent.com/broneq/bdk/v3/schema/state/`, describes the frontmatter only, and is produced by the exporter that writes `schema/settings.json` and `schema/cli/`. Git tracks none of them (`kernel-architecture`, Generated outputs).

#### Scenario: zod changed without export

- **WHEN** a commit changes a state zod schema
- **THEN** the next `pnpm build` rewrites the matching `schema/state/` file and the contract tests read that file, so none can be stale

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

#### Scenario: merge of kernel output

- **WHEN** a Change is opened with `bdk change new` and committed, and branches A and B each write entries with `bdk log add`, resolve one with `bdk log resolve` and park or resume through `bdk change park` and `bdk change resume`, and B is merged into A with `git merge`
- **THEN** the merge has no conflict, every file of the merged Change validates, and `bdk log list --all --json` on the merged branch lists every entry of both branches exactly once

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

The key of a `learning` entry is its fingerprint, compared with every `learning` of the Change. The key of every other type is the type, `normalise(summary)` (`Fingerprints`), the refs as a sorted set, `supersedes`, `ticket` and `group`, compared only with live entries of the Change: status `proposed` or `accepted` and not superseded. A resolved finding that reappears is therefore a new entry, and so is a finding repeated under another ticket: that repetition is what the oscillation check counts (`kernel-loops`, Finding fingerprints and oscillation). Two reviewers of one round that write the same finding in different groups write two entries, each listed by its own group's report (T42-A1). Entries written by the kernel itself (`change new`, `change park`, `change resume`) are never deduplicated. Two processes adding the same entry at the same moment may both write it; that duplicate is visible and harmless.

#### Scenario: resolved entry is not a duplicate

- **WHEN** a `finding` was resolved and `log add` writes the same type, summary and refs again
- **THEN** a new entry is written with `deduplicated: false`

#### Scenario: same finding under another ticket

- **WHEN** ticket `A-1` wrote a `finding` and `log add --ticket A-2` writes the same type, summary and refs
- **THEN** a new entry is written under `A-2` with `deduplicated: false`

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

### Requirement: Spec delta

A spec delta SHALL be a Markdown file in the OpenSpec delta format with at most the four level-2 sections below, and the kernel SHALL read it with this grammar only (D2, D2b, C1-C3).

The file may start with a level-1 title line, which the kernel ignores. Then, in any order, each at most once:

| Section                    | Holds                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `## Purpose`               | Free text of at least 50 characters; replaces the capability's purpose. Required when the capability has no spec file yet.                                                                                  |
| `## ADDED Requirements`    | Requirement blocks to append.                                                                                                                                                                               |
| `## MODIFIED Requirements` | Requirement blocks that replace the block of the same name as a whole.                                                                                                                                      |
| `## REMOVED Requirements`  | Requirement headings. A heading followed by `#### Scenario: <name>` lines removes only those scenarios; a heading without them removes the requirement. Other text (`**Reason**`, `**Migration**`) is free. |

A requirement block starts at `### Requirement: <name>` and ends before the next level-3 or level-2 heading. Its statement is the text before its first scenario and holds the normative word (`spec.normative-word`, default `SHALL`). A scenario starts at exactly `#### Scenario: <name>` and holds a `- **WHEN** ...` bullet and a `- **THEN** ...` bullet; `- **GIVEN**` and `- **AND**` bullets are free. Names are compared whitespace-trimmed and case-sensitive. The checks and their problem codes are `kernel-cli/spec`, `bdk spec delta check`.

#### Scenario: partial removal parsed

- **WHEN** `## REMOVED Requirements` holds `### Requirement: Magic link expires` followed by `#### Scenario: reused link`
- **THEN** the delta removes only scenario `reused link` of that requirement

#### Scenario: removal of a whole requirement

- **WHEN** `## REMOVED Requirements` holds `### Requirement: Legacy login` followed only by a `**Reason**` line
- **THEN** the delta removes the requirement `Legacy login`

### Requirement: Living spec file

Each capability of the living spec SHALL be one file `.bdk/specs/<capability>/spec.md`, written only by the kernel's merge in a canonical form with a merge hash in its frontmatter, so that a manual edit is detectable (D2b, V1-7).

Frontmatter (exactly these two keys, in this order):

| Key              | Value                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `bdk-merge-hash` | `sha256:` and the lowercase hex SHA-256 of the body's UTF-8 bytes: everything after the frontmatter separator (`Markdown document shape`). |
| `bdk-change`     | The id of the Change whose merge last wrote the file.                                                                                      |

The body is rendered canonically: `# <capability> Specification`, a blank line, `## Purpose`, the purpose, `## Requirements`, then each requirement block in order, one blank line between blocks and sections, LF line endings, one final newline, trailing whitespace trimmed. The format is OpenSpec's main spec format, so `openspec validate --specs --strict` accepts the directory (T02 decision Q-1: compatibility proven by a CI contract test, no runtime dependency). A file whose body does not hash to its `bdk-merge-hash`, or without the key, was edited outside the merge: `spec merge` and `change close` refuse with `policy/merge-hash-mismatch`, and `doctor` reports the `merge-hash` finding.

#### Scenario: hash covers the body

- **WHEN** the merge writes a file and one character of its body is then changed
- **THEN** the hash of the body no longer equals `bdk-merge-hash` and `doctor` reports `merge-hash` for the file

#### Scenario: OpenSpec accepts the merged specs

- **WHEN** CI copies the `.bdk/specs/` produced by the E2E merge into `openspec/specs/` of an empty repository and runs `openspec validate --specs --strict`
- **THEN** every capability is valid

#### Scenario: a living spec in the old shape still verifies

- **WHEN** `.bdk/specs/auth/login/spec.md` was merged before this change, so its body starts right under the closing `---`, and `bdk doctor --json` runs
- **THEN** it reports no `merge-hash` finding for the file

### Requirement: Agent registry

The kernel SHALL keep a registry of the subagents of the project's sessions in `.bdk/.machine/agents.sqlite` and `.bdk/.machine/agents/`, written only by the agent hooks, `hooks pre-tool`, `hooks session-start` and `agents wait`, and SHALL derive each agent's state from the recorded signals and the heartbeat at read time (T41-D6).

The registry is live machine state, not a cache: no committed file can rebuild it, so it is a database of its own, never a table of `index.sqlite` (Rebuildable index), and it is never committed (Ignored paths). A registry of another schema version, or one SQLite cannot open, is replaced by an empty one; deleting it loses only the view of agents that run at that moment. Every write runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, as the index does.

| Field           | Type                                                          | Meaning                                                                                                                                             |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string                                                        | The host's `agent_id`; the main thread is `main` and has no row.                                                                                    |
| `type`          | string                                                        | `agent_type` (`bdk:worker`, `Explore`, ...).                                                                                                        |
| `session`       | string                                                        | `session_id` of the payload that created the row.                                                                                                   |
| `parent`        | agent id, `main` or null                                      | From the parent's `PostToolUse` on `Agent` (HOST-FACTS `agent-link`): its `agent_id`, or `main` when it has none.                                   |
| `package`       | relative path or null                                         | The dispatch package path in the parent's `tool_input.prompt` (`guard/dispatch-prompt` ensures exactly one for a BDK adapter).                      |
| `ticket`        | `A-` id or null                                               | The package's ticket.                                                                                                                               |
| `target`        | string or null                                                | The package's target.                                                                                                                               |
| `started-at`    | timestamp or null                                             | `SubagentStart`.                                                                                                                                    |
| `linked-at`     | timestamp or null                                             | The parent's `PostToolUse` on `Agent`; for a background spawn it precedes `started-at` (HOST-FACTS `agent-link`).                                   |
| `ended-at`      | timestamp or null                                             | The last end signal.                                                                                                                                |
| `ended-by`      | `subagent-stop \| task-stop \| agent-result \| stale` or null | Which signal ended it: `SubagentStop` allowed by the continuation check, `PostToolUse` on `TaskStop`, a foreground `Agent` result, a stale session. |
| `continuations` | integer                                                       | Consecutive turn ends the continuation check blocked without progress (`kernel-cli/hooks`, bdk hooks subagent-stop).                                |

A heartbeat file `.bdk/.machine/agents/<id>` is written by the shell prefilter on every tool call of a subagent (`kernel-cli/hooks`, Guard hooks file and prefilter): its modification time is the agent's last activity and its content is `open` between `PreToolUse` and `PostToolUse` and `idle` after. Messages admitted by `hooks pre-tool` are rows of a second table with the sender, the recipient, the ledger id, the time and whether a `wait` of the recipient returned them; a child has reported when the `report` path of its package exists (`log ingest` wrote it) and its `at` is not earlier than the child's link or start, since an older report there is an earlier agent's of the same package (#133), which the registry reads and never stores; the child reports and state changes a `wait` returned are tracked by a per-agent cursor.

State, derived at every read with `last` = the later of the heartbeat time and `started-at`:

| State      | When                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ended`    | `ended-at` is set and no heartbeat is newer than it. A heartbeat newer than `ended-at` (an agent resumed by `SendMessage`, HOST-FACTS `send-by-id`) makes it `running` again.               |
| `suspect`  | Not `ended`, and either the heartbeat is `idle` or absent and `last` (or `linked-at` before any start) is older than `agents.ttl`, or it is `open` and older than `agents.open-call-limit`. |
| `starting` | Linked by the parent, no `SubagentStart` yet, and not `suspect`.                                                                                                                            |
| `running`  | Otherwise.                                                                                                                                                                                  |

`suspect` is never written: the next heartbeat turns the agent `running` without any hook for it. `SubagentStop` is missing when an agent is cut off by `maxTurns` or killed with `TaskStop` (HOST-FACTS `stop-on-maxturns`, `stop-on-taskstop`), so the lease is the only end signal the registry can count on; the others only make the end visible sooner. `hooks session-start` ends, as `stale`, every row of another session whose `last` is older than `agents.ttl`; rows of a session that still runs next to this one keep their state.

#### Scenario: lifecycle of a background worker

- **WHEN** the recorded payloads of `lifecycle-bg.json` arrive in order: the parent's `PostToolUse` on `Agent` with `status: async_launched`, the child's `SubagentStart`, its tool calls and its `SubagentStop`
- **THEN** the row is `starting` after the first, `running` after the second with `parent` set, and `ended` with `ended-by: subagent-stop` after the last

#### Scenario: killed agent

- **WHEN** the recorded payloads of `stop-kill.json` arrive, with a `PostToolUse` on `TaskStop` and no `SubagentStop` for the killed agent
- **THEN** the agent is `ended` with `ended-by: task-stop`

#### Scenario: cut off by maxTurns

- **WHEN** the recorded payloads of `max-turns.json` arrive, with no `SubagentStop`, and `agents.ttl` passes without a heartbeat
- **THEN** the agent is `suspect`

#### Scenario: long tool call is not suspect

- **WHEN** a worker's heartbeat is `open` for eight minutes with `agents.ttl` at 5 min and `agents.open-call-limit` at 12 min
- **THEN** the worker is `running`

#### Scenario: resumed agent runs again

- **WHEN** an agent `ended` by `subagent-stop` receives a `SendMessage` and calls a tool
- **THEN** it is `running` again

#### Scenario: registry is not in the index

- **WHEN** `bdk rebuild` runs or `index.sqlite` is deleted
- **THEN** the registry keeps every row, and `bdk query "select * from agents"` fails because the index has no such table

#### Scenario: stale session

- **WHEN** a session starts and the registry holds a `running` row of another session whose heartbeat is an hour old, and a row of another session whose heartbeat is ten seconds old
- **THEN** the first is `ended` with `ended-by: stale` and the second keeps its state

### Requirement: Review round marker

The kernel SHALL keep `.bdk/.machine/review-round` in the home checkout, never committed, while a `review-fix` ticket of the active Change is open (#166): `bdk attempt open review-fix` writes it holding the ticket id, and `bdk attempt close` of a `review-fix` ticket removes it, whatever the outcome. It only tells the `PreToolUse` prefilter to start the kernel for a main-thread file edit (`kernel-cli/hooks`, Guard hooks file and prefilter); the guard decides from the attempt records, so a marker left behind by a ticket another command closed costs a kernel start and never a deny.

#### Scenario: marker follows the round

- **WHEN** `bdk attempt open review-fix <change>` returns ticket `A-0review1`, and later `bdk attempt close A-0review1 not-run --reason "x"` runs
- **THEN** `.bdk/.machine/review-round` holds `A-0review1` between the two commands, is gone after the close, and `git status --porcelain` never lists it

### Requirement: Run marker

The kernel SHALL record an active `/bdk:run` as one file per session, `.bdk/.machine/runs/<session_id>.json`, never committed, holding `schema: 1`, `session`, `prompt` (the typed command line), `auto` (true when `--auto` was the first argument token), `at` (the kernel clock) and `change-started` (false until the run's `bdk:change` call is admitted). A `session_id` that does not match `^[A-Za-z0-9_-]+$` gets no marker and its `/bdk:run` is blocked with `input/invalid-argument`. Only these writers touch it: `hooks prompt-expansion` writes it for a typed `/bdk:run` (replacing the session's earlier one) and removes it for a typed `/bdk:plan`, `/bdk:execute` or `/bdk:close` of the same session; `hooks pre-tool` sets `change-started`; `hooks session-end` removes it. A marker that does not parse counts as absent, so a model's stage skill call is denied rather than admitted. The marker is a property of a session on one machine, not of the Change: it is not part of the ledger and a second machine never sees it.

#### Scenario: marker of a typed run

- **WHEN** the user types `/bdk:run --auto "Add a notification list"` in session `S1`
- **THEN** `.bdk/.machine/runs/S1.json` validates, holds `auto: true`, `change-started: false` and the typed line as `prompt`, and `git status --porcelain` does not list it

#### Scenario: unreadable marker

- **WHEN** `.bdk/.machine/runs/S1.json` holds `{` and the main thread of `S1` calls `Skill` with `skill: bdk:execute`
- **THEN** `hooks pre-tool` denies the call with `guard/stage-skill`

### Requirement: Part worktree

A plan part with `isolation: worktree` SHALL run, while it is live, in a git worktree the kernel owns, and every other part and all Change state SHALL stay in the home checkout (T45; user decisions 2026-10-04).

- **Home checkout.** The working tree whose branch is bound to the Change (Branch binding). It holds the only `.bdk/.machine/` and the only Change directory the kernel reads or writes; there is one ledger, and nothing of the ledger is ever merged.
- **Location.** `<dir>/<change id>/<part id>`, where `<dir>` is `execution.worktree.dir` resolved against the home checkout's project root (`kernel-settings`, Keys of execution and archive). A `dir` inside the repository must be ignored by git; `part start` refuses with `policy/config-invalid` naming the key otherwise, so a worktree never shows as untracked files.
- **Branch.** `bdk-part/<change id>/<part id>`, created by `git worktree add -b` from the home checkout's `HEAD`, never from the default branch.
- **Home marker.** The file `bdk-home` in the worktree's git directory (`git rev-parse --git-dir` inside the worktree) holds the home checkout's absolute project root and the Change id, one per line. It is how a kernel command run inside the worktree finds its home (`kernel-cli`, Invocation), and how `rebuild` tells a kernel worktree from one the user made.
- **Live.** A part is live while it has a `part start` marker later than its latest done marker and its worktree exists.
- **Work root.** The work root of a task or part target is its part's worktree while the part is live with `isolation: worktree`, and the home checkout otherwise. The diff check, `commit`, `attempt close`, the tree hash of `evidence record` and `evidence check`, and the `execute-part` checks read the files and run git in the work root. The Change target and every other target use the home checkout.
- **What a part branch holds.** Only the part's task commits. A commit in a worktree never stages `.bdk/`, because the Change directory lives in the home checkout. Kernel entries of those commits are written there and are committed by the next home commit or checkpoint.

#### Scenario: worktree from the Change branch

- **WHEN** the home checkout is on the Change branch with two commits the default branch lacks, and `bdk part start 02` runs for a `worktree` part
- **THEN** `git -C <dir>/<change id>/02 log -1 --format=%H` equals the home `HEAD`, the worktree's branch is `bdk-part/<change id>/02`, and its git directory holds `bdk-home` naming the home project root and the Change id

#### Scenario: no Change state in the worktree

- **WHEN** `bdk log add finding "x" --ref src/a.ts` runs with the working directory inside the worktree of part 02
- **THEN** the entry file is written under the home checkout's `.bdk/changes/<id>/log/`, and `git -C <worktree> status --porcelain` lists nothing under `.bdk/`

#### Scenario: dir not ignored

- **WHEN** `.bdk/settings.yaml` sets `execution.worktree.dir: worktrees` and no ignore rule covers `worktrees/`, and `bdk part start 02` runs for a `worktree` part
- **THEN** the exit code is 2 with `rule: policy/config-invalid` naming `execution.worktree.dir`, and no worktree exists

### Requirement: Committed state is hashed byte for byte

The kernel SHALL hash committed state over its exact bytes and SHALL NOT normalise it for any formatter: the graph input hashes over a Change's artifacts (`kernel-pipeline`, Artifact kinds) and the `bdk-merge-hash` of a living spec (`Living spec file`). A tool that rewrites a file under `.bdk/` therefore shows as a stale node, whose `explain` names the recorded and the current hash, and as the `merge-hash` finding of `bdk doctor`; the ledger, attempt records and evidence manifests carry no hash of their own bytes and still read. The protection has three layers: every Markdown file the kernel writes is already in the shape the repository's pinned Prettier produces with its default options (`Markdown document shape`); the kernel-owned `.bdk/.prettierrc` keeps Prettier off `.bdk/` whatever options the project uses (`Formatter guard`); and for every other tool the project's own ignore lists exclude `.bdk/` (`stage-skills`, setup keeps .bdk/ out of the project's tools), while no role rewrites `.bdk/` files (`role-contracts`, Contracts leave BDK's own files to setup).

#### Scenario: prettier over a reviewed Change

- **WHEN** `.bdk/.prettierrc` is deleted from a project whose `tiny` Change passed `gate:review` and whose living spec `auth/login` was merged and committed, and the repository's pinned Prettier runs `--write . --prose-wrap always --print-width 40`
- **THEN** files under `.bdk/` change, `plan-part:01` is `stale` with both hashes in its `why`, `bdk doctor --json` reports the `merge-hash` finding at level `fail` for `.bdk/specs/auth/login/spec.md`, and `bdk log list --json` exits 0

#### Scenario: prettier with .bdk/ ignored

- **WHEN** the same run happens with `.bdk/.prettierrc` as `change new` wrote it
- **THEN** no file under `.bdk/` changes, `plan-part:01` stays `done`, and `bdk doctor --json` reports no `merge-hash` finding

#### Scenario: default Prettier is a no-op on kernel output

- **WHEN** `.bdk/.prettierrc` is deleted from the same project and the pinned Prettier runs `--write .` with default options
- **THEN** no Markdown file the kernel wrote under `.bdk/` changes and `bdk doctor --json` reports no `merge-hash` finding

### Requirement: Run journal

The kernel SHALL keep a run journal at `.bdk/.machine/telemetry/journal.jsonl`: one JSON object per line, appended by the kernel commands (`kernel-cli`, Run journal) and the hooks (`kernel-cli/hooks`, Run journal and verbose lines), never committed, and never larger than 1 MiB.

Every line carries `v: 1`, `kind` (`command`, `guard`, `session`, `agent-start`, `agent-stop`, `question`) and `at`; the other fields per kind are those of the two requirements named above, and `schema/state/journal-line.json` fixes them. A line is at most 4 KiB; a longer value is cut. The journal holds pointers to host transcripts (`transcript` paths), never transcript content, tool output or file content; the only free text it holds is command arguments cut to 200 characters. When an append makes the file reach 1 MiB, the oldest half of its lines is dropped under the `.bdk/.machine` lock, so a reader never sees a cut line. A project root without `.bdk/` gets no journal: the kernel never creates `.bdk/` to write one. Commands run in a part worktree write the journal of the home checkout, as the agent registry does.

#### Scenario: line schema

- **WHEN** an E2E test validates every line an execute run leaves in the journal against `schema/state/journal-line.json`
- **THEN** each line validates and none holds a key outside its kind

#### Scenario: bounded on a long run

- **WHEN** a test appends 20 000 `command` lines of 250 bytes to the journal
- **THEN** the file is below 1 MiB after every append, every line in it parses, and the newest line is the last appended

#### Scenario: parallel appends stay whole

- **WHEN** eight processes append 500 lines each at the same time
- **THEN** every line of the journal parses as JSON

#### Scenario: no .bdk directory

- **WHEN** `bdk version` runs in a git repository without `.bdk/`
- **THEN** no `.bdk/` directory is created

### Requirement: Verbose log

While `.bdk/.machine/verbose` exists, the kernel SHALL write a live log per session at `.bdk/.machine/logs/<session>.live.log`, and the render of a session SHALL be written to `.bdk/.machine/logs/<change>-<session>.log` (`<session>.log` without a Change); both are plain text, never committed, and may hold project content.

Each log file is at most 20 MiB; past it, the oldest half of its lines is dropped. The directory keeps the 20 newest files by modification time; writing a file removes older ones beyond that. `.bdk/.machine/verbose` is an empty file that only `hooks session-start` creates and removes (`kernel-cli/hooks`, Run journal and verbose lines).

#### Scenario: log files capped

- **WHEN** a twenty-first log file is written
- **THEN** `.bdk/.machine/logs/` holds the 20 newest files

#### Scenario: logs never tracked

- **WHEN** a session with verbose on ends in the fixture repository
- **THEN** `git status --porcelain` lists nothing under `.bdk/.machine/`

### Requirement: Diagnostics analysis file

An analysis stored by `bdk diagnostics write` SHALL live at `.bdk/.machine/diagnostics/<change>-<session>.md` (`<session>.md` without a Change), one file per session, replaced on a new write and never committed.

The file holds the five sections of `kernel-cli/diagnostics`, bdk diagnostics write. Only its `## For a BDK issue` section is guaranteed free of project code; the user attaches that section, or the file after reading it, to an issue in the BDK repository. Nothing sends the file anywhere.

#### Scenario: analysis replaced

- **WHEN** `bdk diagnostics write` runs twice for one session
- **THEN** one file exists for the session and it holds the second Markdown

### Requirement: Markdown document shape

Every Markdown file with YAML frontmatter that the kernel writes (Change documents, ledger entries, attempt records, evidence manifests, dispatch packages, reports, generated indexes, rule files, living spec files) SHALL be serialized by one function into this shape: a `---` line, the YAML mapping, a `---` line, then, when the body is not empty, exactly one blank line followed by the body, which ends with a newline (the serializer adds one when the body lacks it). A file with an empty body ends right after the closing `---` line. Line endings are LF. Flow sequences in the frontmatter carry no padding inside the brackets (`[a, b]`), and a Markdown table in a generated body has every column padded to its widest cell. The shape is the one the repository's pinned Prettier produces with default options, so a Prettier pass over a kernel-written file changes no byte.

A reader SHALL treat one blank line directly after the closing `---` line as part of the frontmatter separator, not of the body. A file written before this requirement, whose body starts right under the closing `---`, therefore reads to the same body as the file in the current shape, and reading a document and writing it back yields the current shape byte for byte.

#### Scenario: a log entry with a body

- **WHEN** `bdk log add decision` writes an entry with the body `Chose the shared serializer.`
- **THEN** the file's closing `---` line is followed by one empty line and then `Chose the shared serializer.`, and the file ends with one newline

#### Scenario: an entry without a body

- **WHEN** `bdk log add decision` writes an entry with no body
- **THEN** the file ends with the closing `---` line and one newline

#### Scenario: the old shape reads to the same body

- **WHEN** a rule file holds its body right under the closing `---`, and another file holds the same frontmatter, one blank line and the same body
- **THEN** both read to the same body, and `bdk rules check` passes on both

#### Scenario: round trip is stable

- **WHEN** the kernel reads a document in either shape and writes it back unchanged
- **THEN** the written bytes are the current shape, and a second read and write changes no byte

#### Scenario: every kernel Markdown kind is Prettier-stable

- **WHEN** the contract test writes through the bundle a rule (`rules accept`), a ledger entry with a body and one without, the profile assumption and `change.md` of `change new`, a generated plan index and a merged living spec, and formats each with the repository's pinned Prettier and default options
- **THEN** every formatted text equals the file's bytes

### Requirement: Formatter guard

The kernel SHALL own `.bdk/.prettierrc`, whose content is exactly the line `{ "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }` and a newline. Prettier resolves the nearest configuration file of each file it formats and does not read a `.prettierignore` below its working directory, so this file governs every file under `.bdk/`. `requirePragma` makes Prettier skip a file without an `@format` pragma; JSON has no pragma support, so the override hands every file to the `yaml` parser, which has one. Together they keep Prettier off every file under `.bdk/` (Markdown, YAML, JSON evidence captures and any other kind), whether it runs over the whole tree, on explicit paths (lint-staged, pre-commit hooks) or from a subdirectory. The file is committed; it is not one of the `Ignored paths`. The guard is in force when the file is a mapping that sets `requirePragma: true` and has an override whose `files` is or contains `*` and whose `options.parser` is `yaml`.

Before their first write, `change new`, `config set` and `rules accept` create the file when it is absent. A file that exists is never changed, whatever it holds: the kernel does not take over a configuration the user wrote. `bdk hooks session-start` warns when the guard is not in force (`kernel-cli/hooks`, `bdk hooks session-start`) and never writes it. A refused command writes no guard, as it writes no other file.

#### Scenario: fresh repository

- **WHEN** `bdk change new` runs in a fresh repository
- **THEN** `.bdk/.prettierrc` holds exactly the guard content, and `git status --porcelain` lists it as untracked, not ignored

#### Scenario: a user's file is kept

- **WHEN** `.bdk/.prettierrc` holds `{"semi": false}` and `bdk config set tools.lint none` runs
- **THEN** the file's bytes are unchanged

#### Scenario: explicit paths are skipped

- **WHEN** a rule file under `.bdk/rules/` and a JSON evidence capture are reformatted by hand so that Prettier would change them, `.bdk/.prettierrc` holds the guard content, and the pinned Prettier runs `--check` on each path from the project root, and on the rule from `.bdk/rules/`
- **THEN** every run exits 0, and without the guard the same checks on the project root fail

#### Scenario: a refusal writes no guard

- **WHEN** `bdk change new "x" --kind review` is refused with `policy/empty-range` in a project without `.bdk/.prettierrc`
- **THEN** `.bdk/.prettierrc` still does not exist
