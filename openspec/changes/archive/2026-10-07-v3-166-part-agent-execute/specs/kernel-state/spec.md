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

#### Scenario: package names its draft

- **WHEN** `dispatch build 02 implementer A-7f3k9m2q` runs
- **THEN** the frontmatter holds `draft: .bdk/.machine/drafts/02-implementer-A-7f3k9m2q.md`, and a package without `draft` fails validation naming `draft`

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

## ADDED Requirements

### Requirement: Review round marker

The kernel SHALL keep `.bdk/.machine/review-round` in the home checkout, never committed, while a `review-fix` ticket of the active Change is open (#166): `bdk attempt open review-fix` writes it holding the ticket id, and `bdk attempt close` of a `review-fix` ticket removes it, whatever the outcome. It only tells the `PreToolUse` prefilter to start the kernel for a main-thread file edit (`kernel-cli/hooks`, Guard hooks file and prefilter); the guard decides from the attempt records, so a marker left behind by a ticket another command closed costs a kernel start and never a deny.

#### Scenario: marker follows the round

- **WHEN** `bdk attempt open review-fix <change>` returns ticket `A-0review1`, and later `bdk attempt close A-0review1 not-run --reason "x"` runs
- **THEN** `.bdk/.machine/review-round` holds `A-0review1` between the two commands, is gone after the close, and `git status --porcelain` never lists it
