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
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories), `level` (`blocker \| should-fix \| nice-to-have \| not-a-problem`, optional; the triage level, T42-T, written only by `log triage`)                                                                                                                                                                                                                                                                 |
| `observation` | `severity` (optional), `level` (`blocker \| should-fix \| nice-to-have \| not-a-problem`, optional; the triage level, T42-T, written only by `log triage`)                                                                                                                                                                                                                                                                                                                                                                                                             |
| `blocker`     | `category` (optional), `level` (`blocker \| should-fix \| nice-to-have \| not-a-problem`, optional; the triage level, T42-T, written only by `log triage`)                                                                                                                                                                                                                                                                                                                                                                                                             |
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

#### Scenario: head only on a merge report

- **WHEN** a `report` entry without `group: merge` carries `head`
- **THEN** validation fails naming `head`

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `package` by every `dispatch build` without `--group` and with `rules-read` by the first `rules show --ticket` call under the implementer package, and completed by `attempt close`, with these fields.

| Field           | Type                                                                   | Req. | Stamped | Meaning                                                                                                                              |
| --------------- | ---------------------------------------------------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`        | integer                                                                | yes  | kernel  |                                                                                                                                      |
| `ticket`        | `A-` id                                                                | yes  | kernel  |                                                                                                                                      |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier \| part-lead` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).                                                      |
| `target`        | string                                                                 | yes  |         | Task, part, artifact or Change id.                                                                                                   |
| `attempt`       | integer >= 1                                                           | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                                                        |
| `of`            | integer >= 1                                                           | yes  | kernel  | Budget from policy.                                                                                                                  |
| `scope`         | `full \| high+ \| blockers`                                            | yes  |         |                                                                                                                                      |
| `narrowed-from` | `full \| high+ \| blockers`                                            | no   |         |                                                                                                                                      |
| `escalation`    | boolean                                                                | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.                                        |
| `model`         | string                                                                 | no   | kernel  | On the escalation ticket: `policy.escalation.model` when it opened. `dispatch build` copies it into the ticket's packages (T41-D14). |
| `opened-at`     | timestamp                                                              | yes  | kernel  |                                                                                                                                      |
| `author`        | string                                                                 | yes  | kernel  |                                                                                                                                      |
| `closed-at`     | timestamp                                                              | no   | kernel  | Present exactly when `outcome` is.                                                                                                   |
| `outcome`       | `ok \| fail \| not-run`                                                | no   |         |                                                                                                                                      |
| `findings`      | array of `{fingerprint, type, file, symbol?}`                          | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).                                                 |
| `dropped`       | array of `L-` ids                                                      | no   |         | Findings that fell out of scope N+1.                                                                                                 |
| `rules-read`    | timestamp                                                              | no   | kernel  | First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`.                          |
| `package`       | relative path                                                          | no   | kernel  | The ticket's active package: the latest `dispatch build` of the ticket (T23-D42).                                                    |

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

### Requirement: Evidence manifest

An evidence manifest SHALL record one verification artifact with the working-tree hash of its target at capture (T4, P5), and a manifest SHALL be fresh exactly when that hash equals the current tree hash of its target.

| Field       | Type                                                        | Req. | Stamped | Meaning                                                                                                                 |
| ----------- | ----------------------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `schema`    | integer                                                     | yes  | kernel  |                                                                                                                         |
| `id`        | `E-` id                                                     | yes  | kernel  |                                                                                                                         |
| `kind`      | string                                                      | yes  |         | `tests-scoped`, `lint`, `tests-full`, `lint-full`, `coverage`, `typecheck`, `ui-capture` or a project kind.             |
| `ticket`    | `A-` id                                                     | yes  |         |                                                                                                                         |
| `group`     | kebab-case string                                           | no   | kernel  | The review group of a `<ticket>@<group>` record.                                                                        |
| `tool`      | string                                                      | no   | kernel  | Only on `coverage`: the `tools.test` id measured.                                                                       |
| `target`    | string                                                      | yes  | kernel  | From the ticket.                                                                                                        |
| `at`        | timestamp                                                   | yes  | kernel  |                                                                                                                         |
| `author`    | string                                                      | yes  | kernel  |                                                                                                                         |
| `source`    | `agent:<role> \| kernel`                                    | yes  | kernel  | The role of the ticket's active package; `kernel` without one, and for the `simplify` manifest `attempt close` records. |
| `tree-hash` | hash                                                        | yes  | kernel  |                                                                                                                         |
| `tree`      | array of `{path, hash}`                                     | yes  | kernel  | The files the tree hash covers, each with its `sha256:` hash or `absent`; `evidence check` names the paths that differ. |
| `files`     | array of `{path, hash, stored: committed \| machine}`, >= 1 | yes  | kernel  |                                                                                                                         |
| `verdict`   | `pass \| fail \| not-run`                                   | no   |         |                                                                                                                         |
| `citations` | array of strings                                            | no   |         | JSON pointers or snapshot lines (citation validator).                                                                   |

Tree hash (T23-D7, D16, D45): the scope of a target is its part for a task, the part itself, and every part for the Change. The covered files are the `Files:` paths of every task in the scope that do not match `policy.evidence.non-executable`, plus every file of the working tree (tracked or untracked and not ignored) matching `policy.evidence.build-config`; a path matching `build-config` is always covered. The tree hash is `sha256:` over the covered paths in byte order, each contributing its path, a NUL byte, its file hash (`sha256:` of its bytes) or the marker `absent` when the file does not exist, and a NUL byte, so a rename, a deletion and a new build-config file change it. `tree` lists the same paths with each file's hash. The same function serves `evidence record`, `evidence check`, `attempt close` and the post-task step nodes (`kernel-pipeline`, Artifact kinds).

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

A dispatch package SHALL be written only by `dispatch build`, with the frontmatter fields below (K3, K4, P10) and the body sections that `kernel-cli/dispatch`, `bdk dispatch build`, lists in order; the whole file is at most 12 288 bytes.

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
| `rules`          | array of rule ids           | yes  | kernel  | The rules selected for the ticket, in order (T31); may be empty.                                                                                             |
| `group`          | kebab-case string           | no   | kernel  | Review group of a `dispatch build --group` package (T42-A1).                                                                                                 |
| `files`          | array of paths              | no   | kernel  | The group's file set; present exactly when `group` is.                                                                                                       |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

#### Scenario: package with an unknown adapter

- **WHEN** a dispatch package carries `adapter: planner`
- **THEN** validation fails naming `adapter`

#### Scenario: escalation package names its model

- **WHEN** `dispatch build` builds the `implementer` and the `runner` package of an escalation ticket opened with `policy.escalation.model: opus`
- **THEN** the implementer package holds `model: opus` and the runner package holds no `model`

#### Scenario: package records its rules

- **WHEN** a package is built for a `runner` ticket
- **THEN** its frontmatter holds `rules: []`, and a package without `rules` fails validation naming `rules`

#### Scenario: group without files

- **WHEN** a dispatch package carries `group: p01` and no `files`
- **THEN** validation fails naming `files`

### Requirement: Report envelope

A report's frontmatter SHALL be the role's envelope (at most 15 rendered lines) and its body SHALL be the full report. `log ingest` writes every report, stamping `schema`, `ticket` and `role`; a role writes only the other fields and never a `bdk-entries` block (T23-D14).

| Field      | Type                                                     | Req. | Meaning                                                                                  |
| ---------- | -------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `schema`   | integer                                                  | yes  | Stamped by `log ingest`.                                                                 |
| `ticket`   | `A-` id                                                  | yes  | Stamped by `log ingest` from `--ticket`.                                                 |
| `group`    | kebab-case string                                        | no   | Stamped by `log ingest` for a `<ticket>@<group>` report.                                 |
| `role`     | string                                                   | yes  | Stamped by `log ingest` from the dispatch package; `orchestrator` for the `merge` group. |
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

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the stage of the `to` of the latest `transition` entry by `at` (two transitions of one millisecond are broken by the later stage in pipeline order, then by the greater id: `done plan-verify` and `part start` at one `at` leave the Change in `execute`), where a stage id is its own stage and a node id or instance id maps to its node's `stage` in the pipeline (`kernel-pipeline`, Pipeline file), and `intent` while the ledger holds no `transition`; the state of every graph node is derived the same way (`kernel-pipeline`, Node states); a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from the attempt records of its round, and task progress from commit trailers (`kernel-loops`); the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

In-place mutations, each by one writer: an entry's `status`, with the reason appended to its body (`log resolve`); an entry's `level`, with the triage line appended to its body, and `status: resolved` for `not-a-problem` (`log triage`); `supersedes` of the `--by` entry when an entry is resolved as superseded (`log resolve`); an attempt record from open to close (`attempt close`, `change takeover`), and its removal by the `attempt open` that wrote it when another open ticket of the same loop and target won the race; plan part files when `part split` moves tasks and extends `depends-on`; the generated `plan/index.md` and `design/index.md`; a migration by `bdk rebuild`. Every other committed file in a Change is written once.

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
| `evidence/`                       | `evidence record`, `evidence coverage`; `attempt close` (the `simplify` manifest)                                                                                                                         | kernel                  |
| `dispatch/`                       | `dispatch build`                                                                                                                                                                                          | kernel                  |
| `reports/`                        | `log ingest` (the report of every role, on stdin, at the active or group package's `report` path, and the merged review of the `merge` group)                                                             | kernel                  |
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
