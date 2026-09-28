## MODIFIED Requirements

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open` and completed by `attempt close`, with these fields.

| Field           | Type                                                      | Req. | Stamped | Meaning                                                                                       |
| --------------- | --------------------------------------------------------- | ---- | ------- | --------------------------------------------------------------------------------------------- |
| `schema`        | integer                                                   | yes  | kernel  |                                                                                               |
| `ticket`        | `A-` id                                                   | yes  | kernel  |                                                                                               |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).               |
| `target`        | string                                                    | yes  |         | Task, part, artifact or Change id.                                                            |
| `attempt`       | integer >= 1                                              | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                 |
| `of`            | integer >= 1                                              | yes  | kernel  | Budget from policy.                                                                           |
| `scope`         | `full \| high+ \| blockers`                               | yes  |         |                                                                                               |
| `narrowed-from` | `full \| high+ \| blockers`                               | no   |         |                                                                                               |
| `escalation`    | boolean                                                   | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`. |
| `opened-at`     | timestamp                                                 | yes  | kernel  |                                                                                               |
| `author`        | string                                                    | yes  | kernel  |                                                                                               |
| `closed-at`     | timestamp                                                 | no   | kernel  | Present exactly when `outcome` is.                                                            |
| `outcome`       | `ok \| fail \| not-run`                                   | no   |         |                                                                                               |
| `findings`      | array of `{fingerprint, type, file, symbol?}`             | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).          |
| `dropped`       | array of `L-` ids                                         | no   |         | Findings that fell out of scope N+1.                                                          |

The body is the close reason (`--reason` of `attempt close`, `taken over` from `change takeover`). `not-run` counters and budgets are derived from the records of a loop, target and round (`kernel-loops`, Loops, targets and rounds), never stored.

#### Scenario: closed without timestamp

- **WHEN** an attempt record has `outcome` but no `closed-at`
- **THEN** validation fails naming `closed-at`

#### Scenario: escalation loop name is gone

- **WHEN** an attempt record carries `loop: task-escalation`
- **THEN** reading the Change reports `state/ledger-invalid` naming `loop`

### Requirement: Plan part and plan index

A plan part's frontmatter SHALL carry the part fields of P6 and P7, and `plan/index.md` SHALL be generated from the parts only.

Plan part (`plan/parts/<nn>-<slug>.md`; the task grammar of the body follows the table):

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

The body holds the part's tasks. A task starts at a level-2 heading `## <task-id> <title>`, where `<task-id>` is two digits, a dash and a positive integer (`02-3`) and ends at the next level-2 heading. Task ids are unique across the plan; `plan` writes them with the part's prefix and `part split` keeps a moved task's id. Under a task heading the kernel reads these bold field labels; other text is free:

| Label               | Req.           | Value                                                                                                                    |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `**Files:**`        | yes            | A list; each item holds one backticked relative path, optionally prefixed by `Create:`, `Modify:`, `Test:` or `Delete:`. |
| `**Test cases:**`   | one of the two | A non-empty list of test cases.                                                                                          |
| `**Verification:**` | one of the two | `none` (`.claude/rules/verification-scoping.md`, `Verification: none` task class).                                       |
| `**Depends on:**`   | no             | `none` or comma-separated task ids of the same part.                                                                     |
| `**Stop rule:**`    | no             | The condition under which the worker stops and returns `blocked` (P6).                                                   |

Executable fields are `goal`, `success-measure`, each task title, each `Files:` item, each `Test cases:` item and `Stop rule:`. An executable field holds a placeholder when it contains `TODO`, `TBD` or `FIXME` as a word, `<fill in>` or `[...]`, is `...` or `…` alone, or is wrapped in square brackets as a whole (`[Action verb + what]`).

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

| Type          | Own fields                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decision`    | `profile` (`small \| large`, optional; written only by kernel commands that raise the profile, `change resume --profile` first; raises the effective profile)                                                                                                                                                                                                                  |
| `finding`     | `severity` (`critical \| high \| medium \| low`, optional; the attempt ladder's `high+` scope reads it), `category` (optional; one of the P8 blocking categories)                                                                                                                                                                                                              |
| `observation` | `severity` (optional)                                                                                                                                                                                                                                                                                                                                                          |
| `blocker`     | `category` (optional)                                                                                                                                                                                                                                                                                                                                                          |
| `question`    | `options` (array of strings, optional), `park` (boolean, optional; written only by `change park` and by `attempt close` at the end of the ladder; marks the question that parks the Change)                                                                                                                                                                                    |
| `assumption`  | none                                                                                                                                                                                                                                                                                                                                                                           |
| `risk`        | none                                                                                                                                                                                                                                                                                                                                                                           |
| `learning`    | `fingerprint` (required, kernel-stamped, see `Fingerprints`), `evidence` (array of ids of attempts or entries that support it, optional), `applies` (array of globs, optional), `routed-to` (`rule \| spec \| nothing`, required when `status` is `routed`)                                                                                                                    |
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

### Requirement: Derived state and mutation

The kernel SHALL derive a Change's state from its entries and never store it in a mutable field, and SHALL mutate committed files only in the cases listed here.

Derived: the stage is the stage of the `to` of the latest `transition` entry by `at` (entry times have second precision, so ties are broken by the later stage in pipeline order, then by the greater id: `done plan-verify` and `part start` in one second leave the Change in `execute`), where a stage id is its own stage and a node id or instance id maps to its node's `stage` in the pipeline (`kernel-pipeline`, Pipeline file), and `intent` while the ledger holds no `transition`; the state of every graph node is derived the same way (`kernel-pipeline`, Node states); a Change is parked while its latest `question` with `park: true` (by `at`, ties by id) has no `decision` whose `refs` name that question's id; an entry is `superseded` when another entry names it in `supersedes`; a loop's attempt count, `not-run` counter and remaining budget come from the attempt records of its round, and task progress from commit trailers (`kernel-loops`); the effective profile is the largest of `change.md`'s `profile` and the `profile` of every `decision` entry (`tiny < small < large`); an inferred Change (`source: inferred` in `change.md`) is confirmed once the ledger holds a `transition` with `source: user`. The kernel computes these from the index rows and, in unit tests, from the entry documents alone; both give the same answer.

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

### Requirement: Ledger deduplication

`log add` SHALL return an existing entry instead of writing a new one when the new entry equals it by its dedupe key.

The key of a `learning` entry is its fingerprint, compared with every `learning` of the Change. The key of every other type is the type, `normalise(summary)` (`Fingerprints`), the refs as a sorted set, `supersedes` and `ticket`, compared only with live entries of the Change: status `proposed` or `accepted` and not superseded. A resolved finding that reappears is therefore a new entry, and so is a finding repeated under another ticket: that repetition is what the oscillation check counts (`kernel-loops`, Finding fingerprints and oscillation). Entries written by the kernel itself (`change new`, `change park`, `change resume`) are never deduplicated. Two processes adding the same entry at the same moment may both write it; that duplicate is visible and harmless.

#### Scenario: resolved entry is not a duplicate

- **WHEN** a `finding` was resolved and `log add` writes the same type, summary and refs again
- **THEN** a new entry is written with `deduplicated: false`

#### Scenario: same finding under another ticket

- **WHEN** ticket `A-1` wrote a `finding` and `log add --ticket A-2` writes the same type, summary and refs
- **THEN** a new entry is written under `A-2` with `deduplicated: false`

#### Scenario: learning by fingerprint

- **WHEN** two `learning` entries differ in summary only by case, punctuation and a line number, with different refs
- **THEN** the second `log add` returns the first entry with `deduplicated: true`

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                           | Writers                                                                                                                       | Channel                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `change.md`                    | `change new`; `import` (each v2 design becomes a Change with `source: inferred`, through the code of `change new --inferred`) | kernel                  |
| `log/`                         | the commands of the entry-type table                                                                                          | kernel                  |
| `design.md`, `architecture.md` | `design` skill                                                                                                                | host file tools         |
| `design/parts/`                | `design` skill                                                                                                                | host file tools         |
| `design/index.md`              | `done`, `rebuild`, `change takeover`                                                                                          | kernel                  |
| `plan/parts/`                  | `plan` skill; `part split`                                                                                                    | host file tools; kernel |
| `plan/index.md`                | `done`, `part split`, `rebuild`, `change takeover`                                                                            | kernel                  |
| `spec-delta/`                  | `design` and `plan` skills                                                                                                    | host file tools         |
| `attempts/`                    | `attempt open`, `attempt close`, `change takeover`                                                                            | kernel                  |
| `evidence/`                    | `evidence record`                                                                                                             | kernel                  |
| `dispatch/`                    | `dispatch build`                                                                                                              | kernel                  |
| `reports/`                     | worker and runner roles at the package's `report` path; `log ingest` (a read-only role's report on stdin); `dispatch run`     | host file tools; kernel |
| any file (migration)           | `rebuild`, `change takeover`                                                                                                  | kernel                  |
| the Change directory (archive) | `change close`                                                                                                                | kernel                  |
| `.bdk/rules/<ruleId>.md`       | `rules add --accept`, `rules import`, `import`                                                                                | kernel                  |

Entry types (`source` values each writer stamps):

| Type          | Writers and `source`                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `log add`, `log ingest` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split`, `done` for the profile raise of a split design (`kernel`)                                                 |
| `finding`     | `log add`, `log ingest`; `attempt close` and `commit` for undeclared files, `attempt open` for dropped findings, `commit` and `part done` for the tiny guard (`kernel`)                                                             |
| `observation` | `log add`, `log ingest` (including a downgraded uncategorised blocker, P8)                                                                                                                                                          |
| `blocker`     | `log add`, `log ingest`                                                                                                                                                                                                             |
| `question`    | `log add`, `log ingest`; `change park` and `attempt close` at the end of the ladder (`kernel`, with `park: true`)                                                                                                                   |
| `assumption`  | `log add`, `log ingest`; `change new` for the proposed profile (`kernel`)                                                                                                                                                           |
| `risk`        | `log add`, `log ingest`                                                                                                                                                                                                             |
| `learning`    | `log add`, `log ingest`, `rules add` (`agent:<role>` or `kernel`); status by `log route`                                                                                                                                            |
| `report`      | `log add`, `log ingest`                                                                                                                                                                                                             |
| `transition`  | `hooks prompt-expansion` (`user` for a typed stage command, `policy` for an auto gate, `kernel` for a stage without a gate); `done`, `part start` (without `input-hash`), `part done`, `change takeover`, `change close` (`kernel`) |

Rules without exception: `intent` lives only in `change.md`, written only by `change new` (which `import` reuses); a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `log add` and `log ingest` never write `transition` and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

#### Scenario: every file has a writer

- **WHEN** the write map contract test walks the layout table and the ten entry types
- **THEN** each has at least one writer in the tables above

#### Scenario: log add cannot write a transition

- **WHEN** `log add` is called with `type: transition`
- **THEN** the exit code is 3 and no file is written

#### Scenario: ladder writers are mapped

- **WHEN** the write map contract test reads the records of `attempt open`, `attempt close`, `part done` and `change takeover`
- **THEN** every Change path in their `writes[]` appears in the file table naming them
