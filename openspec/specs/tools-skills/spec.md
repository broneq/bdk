# tools-skills Specification

## Purpose

The user-invoked tools skills of BDK under `skills/tools/`: `commit`, `docs`, `rules`, `adr`, `doctor` and `bdk-cli`. They replace the v2 skills of the same work and reach BDK state only through kernel commands.

## Requirements

### Requirement: Tools skill shape

The tools skills `/bdk:commit`, `/bdk:docs`, `/bdk:rules`, `/bdk:adr`, `/bdk:doctor` and `/bdk:bdk-cli` SHALL live at `skills/tools/<name>/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists. Each SHALL:

- stay at or below 200 lines in `SKILL.md`;
- name BDK skills, roles and agents with the `/bdk:` and `bdk:` namespace, and name no skill of another plugin;
- name no model, in its frontmatter or its prose;
- pass `pnpm skill-check` with no baseline entry.

Every tools skill except `bdk-cli` SHALL start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill, and SHALL list the kernel pair of `kernel-cli`, Invocation, in `allowed-tools`. A missing kernel then stops it with the visible `BDK STOP` line. `commit`, `docs`, `adr` and `bdk-cli` SHALL work without an active Change. `rules` and `doctor` SHALL work without one as well, because the kernel commands they call are not Change-scoped.

`doctor` SHALL set `disable-model-invocation: true` (T02 decision R-14). The other five SHALL NOT set it.

#### Scenario: every tools skill in place

- **WHEN** the content test lists `skills/tools/`
- **THEN** it finds `commit`, `docs`, `rules`, `adr`, `doctor` and `bdk-cli` next to `cr` and `pr-review`, each with a `SKILL.md` of at most 200 lines

#### Scenario: context lines with the kernel pair

- **WHEN** the content test reads `commit`, `docs`, `rules`, `adr` and `doctor`
- **THEN** each body starts with the two context lines naming its own skill, its `allowed-tools` starts with the kernel pair, and the `ctx skill` manifest has an entry for it

#### Scenario: invocation per skill

- **WHEN** the content test reads the frontmatter of the six skills
- **THEN** only `doctor` has `disable-model-invocation: true`

#### Scenario: no foreign plugin and no model

- **WHEN** the content test reads every file under the six skill directories
- **THEN** none names `caveman`, a model name, or a skill namespace other than `bdk:`

### Requirement: The v2 tools skills are removed

The plugin SHALL NOT ship `skills/commit/`, `skills/add-rule/`, `skills/refine-rules/`, `skills/update-docs/`, `skills/explain-complex-code/` or `skills/create-adr/`. Nothing in the repository outside `docs/v3/`, `docs/V3-*.md`, `CHANGELOG.md`, `openspec/changes/archive/` the recorded host payloads under `tests/fixtures/host-payloads/`, and the "Removed skills" sections of `README.md` and `docs/guide/reference/skills.md`, which map each removed skill to its replacement, SHALL name `/bdk:add-rule`, `/bdk:refine-rules`, `/bdk:update-docs`, `/bdk:explain-complex-code` or `/bdk:create-adr`. The `skill-check` baseline SHALL hold no entry for a file of a removed skill or of `skills/tools/commit/`.

#### Scenario: removed directories

- **WHEN** the content test checks the six v2 paths
- **THEN** none exists

#### Scenario: no stale name

- **WHEN** the content test searches the skills, agents, rules, fragments, `README.md`, `STARTUP_INSTRUCTIONS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/` and `docs/guide/` for the five removed skill names, skipping the two "Removed skills" sections
- **THEN** it finds none

#### Scenario: baseline pruned

- **WHEN** `pnpm skill-check` runs
- **THEN** it exits 0 and reports no `baseline-stale` entry, and the baseline names none of the removed files

### Requirement: commit writes the user's commit

`/bdk:commit` SHALL commit the user's changes with a message it writes itself in the Conventional Commits form, `<type>(<scope>): <subject>` with a body that says why. It SHALL take the convention from the project when the project states one, in this order: a commitlint configuration, `CONTRIBUTING.md`, the subjects of the recent `git log`. A limit the project sets (header length, allowed types and scopes) SHALL win over the default. It SHALL add no co-author, tool or agent attribution unless the project's convention asks for one.

It SHALL commit what is staged. When nothing is staged, it SHALL stage the paths its argument names. With no argument, it SHALL first show the changed and untracked paths and ask which to stage, and it SHALL never stage everything unasked. It SHALL run the user's git hooks and SHALL never pass `--no-verify`. When a hook rejects the commit because of the message, it SHALL fix the message and try once more. On any other rejection, it SHALL report the hook's output and stop.

It SHALL NOT commit a task or a review fix of a Change: those go through `bdk commit`, which `/bdk:execute` and `/bdk:cr` run. It SHALL NOT add BDK trailers. Its `allowed-tools` SHALL grant only the kernel pair, `AskUserQuestion`, `Read`, and `Bash` for `git status`, `git diff`, `git log`, `git add` and `git commit`. It SHALL set `disallowed-tools: Edit Write NotebookEdit`.

#### Scenario: no delegation

- **WHEN** the content test reads `skills/tools/commit/SKILL.md`
- **THEN** it names no other plugin's skill and has no `hooks` frontmatter that runs `hooks skill-exists`

#### Scenario: project convention wins

- **WHEN** the content test reads the commit skill
- **THEN** it names commitlint, `CONTRIBUTING.md` and `git log` as convention sources, and `--no-verify` only to forbid it

#### Scenario: nothing staged

- **WHEN** the content test reads the commit skill
- **THEN** it says that with nothing staged and no argument the skill asks which paths to stage, and never stages everything unasked

### Requirement: docs creates and refreshes architecture documentation

`/bdk:docs` SHALL take one argument and pick its mode from it:

- **refresh** when the argument is an existing Markdown document: the skill compares each section, file tree and diagram of the document with the current code, shows the planned changes, and rewrites only after the user agrees. The result is uniform text, with no changelog, no "updated on" note and no diff marker. Accurate prose the user wrote stays.
- **create** when the argument is a code path: the skill writes a new document for that module, at the path the user names, or else at `docs/architecture/<module>.md`. It never writes under `.bdk/`.

Both modes SHALL produce the same document shape, which a reference file of the skill holds: an overview of two or three sentences, the module's file tree, at least one Mermaid diagram, the non-obvious rules with examples, prototype examples (no copied implementation, each under 20 lines), the main components and the existing tests. The diagram rules the skill needs SHALL be in its own files, because `bdk-craft` may not be installed. The skill SHALL write nothing but the one document.

#### Scenario: mode from the argument

- **WHEN** the content test reads `skills/tools/docs/SKILL.md`
- **THEN** it names both modes, the refresh mode for an existing Markdown file and the create mode for a code path, and the default `docs/architecture/` location

#### Scenario: refresh asks first

- **WHEN** the content test reads the refresh mode
- **THEN** it shows the planned changes and asks before it writes, and it forbids changelog and "updated on" markers

#### Scenario: one shared shape

- **WHEN** the content test reads the docs skill directory
- **THEN** one reference file holds the document shape, and `SKILL.md` links it, and nothing names `.bdk/explain-complex-code/` or `/bdk:mermaid-drawer`

### Requirement: rules audits, captures and checks rules through the kernel

`/bdk:rules` SHALL take a mode as its first argument:

- **`audit`** (also the default with no argument):
  - It reads `bdk rules stats --entries --json` and groups the recurring items and the raw entries by meaning.
  - It drops every group that is not a rule as `rules/README.md` defines one: a choice among valid alternatives, house or knowledge. A fact about the project's own system, a process lesson and a principle without alternatives are dropped.
  - It proposes the rest to the user, each with its text, kind, severity, `applies` and the refs it comes from, through the `Asking the user` section of its context.
  - It adopts each accepted proposal with `bdk rules accept` and its `--from` refs.
  - It then reads `bdk rules prune --json` and offers each listed rule for removal.
- **`capture <lesson>`**:
  - With an active Change, it records the lesson as `bdk log add learning` with refs and `--applies`. The audit reads it later.
  - Without an active Change, it applies the same admission test, proposes one rule, and adopts it with `bdk rules accept` once the user agrees.
  - A lesson that fails the test is reported as such, together with where it belongs instead: code, a doc comment, documentation or a spec.
- **`check`**: it runs `bdk rules check --json` and `bdk rules export --claude --check --json`, and reports each problem with the command that repairs it.

The skill SHALL create a rule only through `bdk rules accept`, never by writing a rule file. It SHALL remove a rule only after the user accepted the removal. A removal sets `removed` in the rule's frontmatter and keeps the body as a tombstone. Afterwards the skill runs `bdk rules check` and `bdk rules export --claude`. It SHALL NOT write `.claude/rules/` by hand.

#### Scenario: audit adopts through the kernel

- **WHEN** the content test reads `skills/tools/rules/SKILL.md`
- **THEN** it names `bdk rules stats --entries`, `bdk rules accept` with `--from`, and `bdk rules prune`, and says that nothing is adopted before the user accepts

#### Scenario: capture inside and outside a Change

- **WHEN** the content test reads the capture mode
- **THEN** it names `bdk log add learning` with `--applies` for an active Change, and `bdk rules accept` after the user's agreement without one

#### Scenario: admission test from the rule pack

- **WHEN** the content test reads the rules skill
- **THEN** it points to the definition in `rules/README.md` and names the three kinds of text that are not rules

#### Scenario: removal leaves a tombstone

- **WHEN** the content test reads the rules skill
- **THEN** a removal sets `removed` and keeps the body, and is followed by `bdk rules check` and `bdk rules export --claude`

### Requirement: adr records one decision as MADR

`/bdk:adr` SHALL write one Architecture Decision Record in the MADR form to `docs/adr/`, numbered one above the highest existing record. Its input SHALL be either:

- a free-form decision: the context, the options and the choice;
- the id of a `decision` entry, bare in the active Change or qualified as `<changeId>/L-...`. The skill reads the entry with `bdk log show <id> --json` and takes its summary, body and refs as the record's content.

It SHALL ask only for what neither input gives: the status, and missing options or drivers. It SHALL apply the `Rules: architecture` section of its context. It SHALL keep the MADR template in a reference file of its own. It SHALL write nothing but the one record.

#### Scenario: from a ledger decision

- **WHEN** the content test reads `skills/tools/adr/SKILL.md`
- **THEN** it names `bdk log show` for a `decision` entry id, bare or qualified, and `docs/adr/` as the target

#### Scenario: template kept with the skill

- **WHEN** the content test reads the adr skill directory
- **THEN** a reference file holds the MADR sections, and `SKILL.md` links it

### Requirement: doctor walks the findings of bdk doctor

`/bdk:doctor` SHALL run `bdk doctor --json`. When `ok` is true, it SHALL report it and stop. Otherwise it SHALL:

- run `bdk doctor --fix --json` for the repairs that need no system change;
- run `bdk doctor --json` again;
- take each remaining finding in turn. A repair that is a kernel or BDK command (`bdk rebuild`, `bdk rules import`, `bdk rules export --claude`, `/bdk:setup`) is offered and run on the user's yes. A repair that changes the system (a Node install or switch, a `git restore` of a spec) is shown with its exact command and run only after the user agrees to that one command.

It SHALL end with the findings left and why. It SHALL never install software without the user's agreement for that step.

#### Scenario: fix first, then ask

- **WHEN** the content test reads `skills/tools/doctor/SKILL.md`
- **THEN** it names `bdk doctor --json` and `bdk doctor --fix --json`, and says each system change runs only after the user agrees to it

### Requirement: bdk-cli points to the kernel help

`/bdk:bdk-cli` SHALL be a skill that fronts a CLI: `metadata.fronts-cli` set to `bdk`, at most 30 lines, and model-invocable. It SHALL say:

- when to reach for the kernel: Change state, the ledger, rules, evidence and configuration questions;
- the invocation form `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <group> <verb>`, with `--json` for output a caller acts on;
- that `bdk --help` and `bdk <group> --help` are the only usage reference.

It SHALL copy no flag table, subcommand list or exit code.

#### Scenario: thin front

- **WHEN** `pnpm skill-check` checks `skills/tools/bdk-cli/SKILL.md`
- **THEN** the `cli-front` rule passes, the file has at most 30 lines, and it names `--help`
