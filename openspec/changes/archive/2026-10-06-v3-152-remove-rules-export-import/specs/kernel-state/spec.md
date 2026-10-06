## MODIFIED Requirements

### Requirement: Rule file frontmatter

A rule file `.bdk/rules/<ruleId>.md` SHALL carry the frontmatter below and the rule text as its body (R-rule-id, T5, T02 decision Q-5).

| Field      | Type                                           | Req.                   | Meaning                                                                                                                    |
| ---------- | ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `schema`   | integer                                        | yes                    |                                                                                                                            |
| `id`       | `[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[1-9][0-9]*` | yes                    | Equals the file name without `.md` (`API-4`, `BDK-SEC-2`); `BDK-` only in the bundle.                                      |
| `kind`     | `house \| knowledge`                           | yes                    | `house`: a choice among valid alternatives; `knowledge`: a fact that corrects the model (T5, `rule-pack`, What a rule is). |
| `applies`  | array of globs                                 | no                     | Absent: every file.                                                                                                        |
| `roles`    | array of role names                            | no                     | Absent: every role.                                                                                                        |
| `severity` | `critical \| high \| medium \| low`            | yes                    |                                                                                                                            |
| `origin`   | `bdk \| user \| <changeId>/<id>`               | yes                    | The shipped pack, `rules accept` without `--from`, or the qualified entry or attempt finding the rule was adopted from.    |
| `evidence` | array of qualified ids                         | no                     | Every `--from` ref of `rules accept`.                                                                                      |
| `since`    | date `yyyy-mm-dd`                              | yes                    |                                                                                                                            |
| `source`   | string                                         | when `kind: knowledge` | Where the stated fact comes from (T5); unrelated to provenance `source`.                                                   |
| `verified` | date                                           | when `kind: knowledge` |                                                                                                                            |
| `removed`  | string                                         | no                     | Tombstone reason; the id is never reused.                                                                                  |

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
