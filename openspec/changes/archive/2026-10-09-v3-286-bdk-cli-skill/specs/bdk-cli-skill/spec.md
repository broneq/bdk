## ADDED Requirements

### Requirement: The cli skill

The `bdk` plugin SHALL ship `/bdk:cli` (`plugins/bdk/skills/cli/SKILL.md`), a model-invocable skill that declares `metadata.fronts-cli: bdk`. It SHALL map each kind of question about the state of a BDK project to the `bdk` command that answers it, say how to read the exit codes and `--json`, name `bdk --help` as the usage reference, and state that a command which writes belongs to its stage skill. It SHALL NOT copy flags or argument lists.

#### Scenario: Shape of the skill

- **WHEN** the file is read
- **THEN** its frontmatter holds `metadata.fronts-cli: bdk`, no `disable-model-invocation`, and its body names `bdk --help`

#### Scenario: A question is answered through the CLI

- **WHEN** the user asks, in a configured project, which command settings the project uses and where the setting comes from
- **THEN** the session invokes `/bdk:cli`, runs `bdk config show`, and answers from its output

#### Scenario: Work is routed to a stage skill

- **WHEN** the user asks to carry an issue through every stage to a pull request
- **THEN** the session names or invokes `/bdk:run` and calls no writing `bdk` command itself

### Requirement: The skill follows the CLI

A test SHALL fail when a command declared by a `bdk` command group is not named in `plugins/bdk/skills/cli/SKILL.md` as `bdk <group> <verb>` (or `bdk <group>` for a group with one command), and when the skill names a `bdk <group> <verb>` the CLI does not declare.

#### Scenario: Command added

- **WHEN** a command group declares a verb the skill does not name
- **THEN** `pnpm test` fails and names the missing command

#### Scenario: Command removed or renamed

- **WHEN** the skill names `bdk <group> <verb>` and no group declares it
- **THEN** `pnpm test` fails and names the stale command

### Requirement: Eval cases

The suite SHALL hold the `block` cases `cli-config`, `cli-run-state`, `cli-findings` and `cli-route`, each with a `skill-fired` grader, a grader on the reply and a tool grader. Run with and without the plugin, the with arm SHALL score 1.00 in `cli-config` and `cli-route` and at least 0.80 in `cli-run-state`, and the without arm SHALL score lower in those three. `cli-findings` guards that the session reads a round without writing a decision; the without arm can read the log raw, so its difference may be 0.

#### Scenario: Cases load

- **WHEN** the free loader check of the eval suite runs
- **THEN** the four cases load with no problem
