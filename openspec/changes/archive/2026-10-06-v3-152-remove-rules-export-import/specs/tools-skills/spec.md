## MODIFIED Requirements

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
- **`check`**: it runs `bdk rules check --json` and reports each problem with the file that repairs it.

The skill SHALL create a rule only through `bdk rules accept`, never by writing a rule file. It SHALL remove a rule only after the user accepted the removal. A removal sets `removed` in the rule's frontmatter and keeps the body as a tombstone. Afterwards the skill runs `bdk rules check`. It SHALL NOT write or name `.claude/rules/`: that directory belongs to the project, not to BDK.

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
- **THEN** a removal sets `removed` and keeps the body, and is followed by `bdk rules check`, and the skill names neither `bdk rules export` nor `.claude/rules/`

### Requirement: doctor walks the findings of bdk doctor

`/bdk:doctor` SHALL run `bdk doctor --json`. When `ok` is true, it SHALL report it and stop. Otherwise it SHALL:

- run `bdk doctor --fix --json` for the repairs that need no system change;
- run `bdk doctor --json` again;
- take each remaining finding in turn. A repair that is a kernel or BDK command (`bdk rebuild`, `bdk rules check`, `/bdk:setup`) is offered and run on the user's yes. A repair that changes the system (a Node install or switch, a `git restore` of a spec) is shown with its exact command and run only after the user agrees to that one command.

It SHALL end with the findings left and why. It SHALL never install software without the user's agreement for that step.

#### Scenario: fix first, then ask

- **WHEN** the content test reads `skills/tools/doctor/SKILL.md`
- **THEN** it names `bdk doctor --json` and `bdk doctor --fix --json`, and says each system change runs only after the user agrees to it
