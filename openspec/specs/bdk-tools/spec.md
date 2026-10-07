# bdk-tools Specification

## Purpose

Defines the tool skills of the `bdk` plugin, `/bdk:commit` and `/bdk:adr`: what each one produces, what it never does, and the eval cases that measure it. The diagram tool `mermaid-drawer` is a craft skill of `bdk-craft` (spec `craft-skills`).

## Requirements

### Requirement: Tools run without a BDK configuration

`/bdk:commit` and `/bdk:adr` SHALL be skills of the `bdk` plugin (`plugins/bdk/skills/commit/`, `plugins/bdk/skills/adr/`) that run in any git project, whether or not it holds `.bdk/settings.yaml` or `openspec/`. Neither SHALL call a `bdk` command or need another plugin.

#### Scenario: Unconfigured project

- **WHEN** `/bdk:commit` runs in a git repository without `.bdk/` and `openspec/`, with a staged change
- **THEN** it commits the change and does not report "BDK not configured"

### Requirement: Commit follows the project's convention

`/bdk:commit` SHALL write the message in the project's convention, taken from the first source that states one: a commitlint configuration, the commit section of `CONTRIBUTING.md`, the recent commit subjects. Without any, it SHALL write a Conventional Commits message: `<type>(<scope>): <subject>`, an imperative subject of at most 72 characters, and a body that says why when the subject does not say everything. Types, scopes, case and header length the project sets SHALL win over these defaults. The message SHALL carry no agent or tool attribution unless the project's convention shows one.

#### Scenario: House types and scopes

- **WHEN** the repository's `commitlint.config.mjs` allows only the types `add`, `change`, `fix`, `remove`, `docs`, `chore`, only the scopes `billing`, `auth`, `web`, and a header of at most 50 characters, and a change under `src/billing/` is staged
- **THEN** the commit header uses one of those types with the scope `billing` and is at most 50 characters long

#### Scenario: No attribution by default

- **WHEN** no commitlint rule, `CONTRIBUTING.md` section or recent commit carries a `Co-Authored-By` trailer
- **THEN** the commit message holds no `Co-Authored-By` line

### Requirement: Commit stages only what belongs to the change

When something is staged, `/bdk:commit` SHALL commit exactly that and name what stayed unstaged. When an argument names paths or a scope, it SHALL stage only those. When nothing is staged and there is no argument, it SHALL stage the tracked changes and the new files they use or test, SHALL NOT stage a file that looks like a secret or a local artefact, and SHALL list every file it left out. When the files it picked hold unrelated changes, it SHALL make one commit per concern. It SHALL NOT stage with `git add -A`, `git add .` or `git add --all`.

#### Scenario: Secrets stay out

- **WHEN** nothing is staged, `src/cart.js` is modified to import a new `src/discount.js`, `test/discount.test.js` is new, and `.env.local` and `debug.log` are untracked
- **THEN** the commit holds `src/cart.js`, `src/discount.js` and `test/discount.test.js`, not `.env.local` or `debug.log`, and the report names the two files left out

#### Scenario: Unrelated changes split

- **WHEN** nothing is staged and the working tree holds a typo fix in `README.md` and an unrelated bug fix in `src/`
- **THEN** two commits are made, one of type `docs` for `README.md` and one of type `fix` for the bug fix

### Requirement: Commit never bypasses the user's safeguards

`/bdk:commit` SHALL NOT pass `--no-verify`, SHALL NOT amend a commit unless asked, and SHALL NOT push. When a hook rejects the message, it SHALL fix the message and commit again; when a hook rejects for another reason, it SHALL report the hook's output and stop. It SHALL end with the hash and subject of each commit it made.

#### Scenario: Hook rejects for a failing check

- **WHEN** a `pre-commit` hook exits non-zero because a lint check fails
- **THEN** no commit is made, the skill reports the hook's output, and it does not retry with `--no-verify`

### Requirement: ADR lands in the project's ADR home and format

`/bdk:adr` SHALL write one record into the project's existing ADR directory, in the format of its existing records, numbered one above the highest existing number with the same number width. Without an ADR directory it SHALL write `docs/adr/NNNN-<slug>.md` in the MADR form: status, date and people in frontmatter, the sections "Context and Problem Statement", "Decision Drivers", "Considered Options", "Decision Outcome" and "Pros and Cons of the Options", pros and cons for every option marked with ✅ and ❌, and `{TBD}` for people the input does not name. It SHALL NOT commit.

#### Scenario: Fresh project

- **WHEN** a project without an ADR directory asks to record an accepted decision between two options
- **THEN** `docs/adr/0001-<slug>.md` exists with status `accepted`, the MADR sections, ✅ and ❌ markers for both options, and `{TBD}` people fields

#### Scenario: House format and numbering

- **WHEN** `doc/decisions/` holds records `0001` to `0007` with the sections "Status", "Context", "Decision" and "Consequences"
- **THEN** the new record is `doc/decisions/0008-<slug>.md` with those four sections

### Requirement: ADR from a Change's decision

`/bdk:adr` SHALL take its input either as free-form text or as a decision `D<N>` of an OpenSpec Change, active or archived. For a Change's decision it SHALL read the `### D<N>.` section of that Change's `design.md`, take its choice as the outcome and its alternatives as the other considered options, and link the `design.md` under "More Information". The status SHALL be the one the input states; otherwise `accepted` for a decision of an archived Change and `proposed` for one of an active Change; otherwise it SHALL ask, and write `proposed` and say so when it cannot ask.

#### Scenario: Archived Change decision

- **WHEN** the user asks for an ADR of decision D2 of the archived Change `add-export`, whose D2 chose streaming over two alternatives
- **THEN** the record has status `accepted`, lists streaming and both alternatives as considered options, and links that Change's `design.md`

### Requirement: ADR supersedes the record it replaces

When the new decision replaces an existing record, `/bdk:adr` SHALL name the replaced record in the new one and set the replaced record's status to superseded by the new record, in the replaced record's status style, changing nothing else in it.

#### Scenario: Polling replaced

- **WHEN** `doc/decisions/0004-poll-for-notifications.md` is accepted and the user records that notifications move from polling to server-sent events
- **THEN** `0004`'s status says it is superseded by `0008`, and the new record names `0004`

### Requirement: Tools have eval cases

Each tool SHALL have at least two eval cases under `plugins/bdk/evals/` (`commit-*`, `adr-*`), tagged `block`, run with and without the plugin, with the graders the `skill-evals` spec requires for a block case. The with/without scores of the measured run SHALL be recorded in the Change that adds or changes the tool.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** every `commit-*` and `adr-*` case loads with no error and its scaffold exits 0
