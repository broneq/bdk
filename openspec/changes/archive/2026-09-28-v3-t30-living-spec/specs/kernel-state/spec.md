## MODIFIED Requirements

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

### Requirement: Plan part and plan index

A plan part's frontmatter SHALL carry the part fields of P6 and P7, and `plan/index.md` SHALL be generated from the parts only.

Plan part (`plan/parts/<nn>-<slug>.md`; the task grammar of the body follows the table):

| Field             | Type                                | Req. | Meaning                                                                                                                       |
| ----------------- | ----------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| `schema`          | integer                             | yes  |                                                                                                                               |
| `id`              | two digits                          | yes  | Equals `<nn>` of the file name.                                                                                               |
| `title`           | string                              | yes  |                                                                                                                               |
| `goal`            | string                              | yes  |                                                                                                                               |
| `success-measure` | string                              | yes  | What a reviewer can observe.                                                                                                  |
| `do-not-touch`    | array of globs                      | yes  | Empty allowed.                                                                                                                |
| `depends-on`      | array of part ids                   | yes  | Empty allowed.                                                                                                                |
| `spec-impact`     | `none` or array of capability names | no   | D2; absent means `none` for `tiny` and `small`, and fails the plan part check for `large` (`kernel-loops`, Plan part checks). |

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
| `.bdk/rules/<ruleId>.md`          | `rules add --accept`, `rules import`, `import`                                                                                                                                                            | kernel                  |

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
| `learning`    | `log add`, `rules add` (`agent:<role>` or `kernel`); status by `log route`                                                                                                                                                          |
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

## ADDED Requirements

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

| Key              | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `bdk-merge-hash` | `sha256:` and the lowercase hex SHA-256 of the body's UTF-8 bytes: everything after the closing `---` line. |
| `bdk-change`     | The id of the Change whose merge last wrote the file.                                                       |

The body is rendered canonically: `# <capability> Specification`, a blank line, `## Purpose`, the purpose, `## Requirements`, then each requirement block in order, one blank line between blocks and sections, LF line endings, one final newline, trailing whitespace trimmed. The format is OpenSpec's main spec format, so `openspec validate --specs --strict` accepts the directory (T02 decision Q-1: compatibility proven by a CI contract test, no runtime dependency). A file whose body does not hash to its `bdk-merge-hash`, or without the key, was edited outside the merge: `spec merge` and `change close` refuse with `policy/merge-hash-mismatch`, and `doctor` reports the `merge-hash` finding.

#### Scenario: hash covers the body

- **WHEN** the merge writes a file and one character of its body is then changed
- **THEN** the hash of the body no longer equals `bdk-merge-hash` and `doctor` reports `merge-hash` for the file

#### Scenario: OpenSpec accepts the merged specs

- **WHEN** CI copies the `.bdk/specs/` produced by the E2E merge into `openspec/specs/` of an empty repository and runs `openspec validate --specs --strict`
- **THEN** every capability is valid
