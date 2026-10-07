# bdk-cli/config Specification

## Purpose

Defines the `bdk config` command group: the three layer files of the BDK configuration and how they merge, the settings keys with their types and defaults, and the `show`, `check` and `set` commands through which skills and agents get the resolved configuration, or learn that the project is not configured.

## Requirements

### Requirement: Layer files

The configuration SHALL be resolved from built-in defaults and three layer files, a higher layer winning over a lower one: `default` < `global` < `project` < `local`. These names SHALL identify the layers in every output.

| Layer     | File                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `global`  | `$XDG_CONFIG_HOME/bdk/settings.yaml` when `XDG_CONFIG_HOME` is set to an absolute path, else `~/.config/bdk/settings.yaml` |
| `project` | `<root>/.bdk/settings.yaml`, committed                                                                        |
| `local`   | `<root>/.bdk/settings.local.yaml`, not committed                                                               |

The project root `<root>` SHALL be the nearest directory, from the working directory upwards, that holds `.bdk/` or `.git`; when none does, the working directory. An absent file SHALL be skipped and an empty file SHALL be an empty layer. A file that is not valid YAML, or whose top level is not a mapping, SHALL be a problem naming the file and, for a syntax error, the line.

#### Scenario: Precedence

- **WHEN** the global, project and local files each set `execution.lead` to a different value
- **THEN** `bdk config show execution.lead` prints the local value with origin `local`

#### Scenario: XDG_CONFIG_HOME

- **WHEN** `XDG_CONFIG_HOME` points at a directory holding `bdk/settings.yaml`
- **THEN** that file is the global layer and `~/.config/bdk/settings.yaml` is not read

#### Scenario: Project root from a subdirectory

- **WHEN** `bdk config show` runs in `<root>/src/deep` and `<root>` holds `.bdk/settings.yaml` and `openspec/`
- **THEN** the project and local layers are read from `<root>/.bdk/`

### Requirement: Merge

Layers SHALL merge key by key: mappings merge deeply; an array whose items are all mappings with an `id` SHALL merge item by item on `id`, a higher item deep-merging into the lower item of the same `id` and a new `id` being appended in the higher layer's order; every other array and every scalar SHALL be replaced whole by the higher layer. Two items with the same `id` in one layer SHALL be a problem naming the key and the `id`.

#### Scenario: Array merged by id

- **WHEN** the project layer declares `tools.test` items `unit` and `e2e`, and the local layer declares a `tools.test` item `unit` with only `scoped`
- **THEN** the resolved `tools.test` holds `unit` with the project fields plus the local `scoped`, followed by `e2e` unchanged

#### Scenario: Scalar array replaced

- **WHEN** the project layer sets `languages: [typescript, react]` and the local layer sets `languages: [typescript]`
- **THEN** the resolved `languages` is `[typescript]`

#### Scenario: Duplicate id

- **WHEN** one layer lists two `tools.lint` items with the same `id`
- **THEN** `bdk config check` reports a problem naming that layer's file, `tools.lint` and the `id`

### Requirement: Settings keys

The configuration SHALL accept exactly these keys; any other key at any level SHALL be a problem naming its full dotted key. A key segment, a `models` role, a `steps` orchestrator and an `id` SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`). An item of an array merged by `id` SHALL be addressed by its `id` as a key segment (`tools.test.unit.scoped`) in every output and argument.

| Key                                                  | Type                                                                                                         | Default      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| `tools.test`, `tools.lint`, `tools.build`            | items by `id`: `command` (string, required), `scoped` (string holding `{files}`, optional), `timeout` (integer seconds, 1 to 86400, optional; `bdk check run` uses 600 when absent) | `[]`         |
| `tools.e2e`                                          | items by `id`: `start` (command), `ready` (URL or command), `driver` (`cli`, `http`, `browser`), `env` (map of variable name to string, optional), `browser` (`chrome-devtools-axi` or `chrome-devtools-mcp`, optional; read only for `driver: browser`, where an absent field means `chrome-devtools-axi`); all but `env` and `browser` required | `[]`         |
| `languages`                                          | list of kebab-case names                                                                                     | `[]`         |
| `rules.disabled`                                     | list of rule names                                                                                           | `[]`         |
| `models.<role>`                                      | model name or alias                                                                                          | none set     |
| `policy.gates.design`, `policy.gates.review`         | `manual` or `auto`                                                                                           | `manual`     |
| `policy.questions`                                   | `decide-and-record` or `stop`                                                                                | `stop`       |
| `policy.budgets.part-attempts`, `policy.budgets.review-rounds` | integer, at least 1                                                                                 | `3`, `3`     |
| `policy.budgets.verifier`                           | integer, at least 1: the most verifier passes one design or plan orchestrator run spends                     | `3`          |
| `policy.escalation.model`                            | model a blocked part is retried with                                                                         | `opus`       |
| `plan.part.max-tasks`, `plan.part.max-files`, `plan.part.max-bytes` | integer, at least 1                                                                           | `5`, `10`, `8192` |
| `steps.<orchestrator>`                               | items by `id`: `enabled` (boolean, optional), `use` (project skill or agent replacing the block, optional)    | none set     |
| `execution.lead`                                     | `background` or `foreground`                                                                                 | `background` |
| `hooks.subagent-git`                                 | boolean                                                                                                      | `false`      |

A missing required field, a value of the wrong type or outside its allowed values SHALL be a problem naming the full dotted key and what is allowed. The task that builds the consumer of a key MAY change that key's row through a delta of this spec.

#### Scenario: Unknown key with a suggestion

- **WHEN** `.bdk/settings.yaml` sets `plan.part.max-task: 4`
- **THEN** `bdk config check` reports `plan.part.max-task` as an unknown key, suggests `plan.part.max-tasks`, and exits 1

#### Scenario: Defaults without a layer value

- **WHEN** no layer sets any `plan.part` key
- **THEN** `bdk config show plan.part` prints `max-tasks` 5, `max-files` 10 and `max-bytes` 8192, each with origin `default`

#### Scenario: Check timeout

- **WHEN** `.bdk/settings.yaml` gives the `tools.test` item `unit` the field `timeout: 0`
- **THEN** `bdk config check` reports `tools.test.unit.timeout` and that it must be at least 1, and exits 1

#### Scenario: Browser tool of an E2E entry

- **WHEN** `.bdk/settings.yaml` gives the `tools.e2e` item `web` the field `browser: chrome-devtools-mcp`, and the item `admin` the field `browser: playwright`
- **THEN** `bdk config check` accepts `tools.e2e.web.browser`, reports `tools.e2e.admin.browser` with the allowed values, and exits 1

#### Scenario: Verifier budget

- **WHEN** no layer sets `policy.budgets.verifier` and the project layer sets nothing under `policy`
- **THEN** `bdk config show policy.budgets.verifier` prints 3 with origin `default`, and `policy.budgets.verifier: 0` in a layer makes `bdk config check` report `policy.budgets.verifier` and exit 1

### Requirement: Configured project

A project SHALL count as configured when its project layer file `.bdk/settings.yaml` exists and its root holds an `openspec/` directory. Only `/bdk:setup` is meant to run without a configuration; this command group SHALL still run in an unconfigured project, and `set` SHALL create a missing layer file and its directory.

#### Scenario: set creates the project file

- **WHEN** `bdk config set execution.lead foreground` runs in a project without `.bdk/`
- **THEN** `.bdk/settings.yaml` exists and holds `execution.lead: foreground`, and the exit code is 0

### Requirement: config show

`bdk config show [<key>]` SHALL print the resolved configuration as one line per leaf, `<dotted key>: <value as JSON>  # <origin layer>`, in the order of the keys table and, for items, of the merged array, preceded by one line naming the project root and the layer files that exist. With `<key>`, it SHALL print only the leaves at or under that key; a key that names no setting SHALL be the usage error `usage/unknown-key` with the closest known key as a hint. Under `--json` the result SHALL hold `status`, `root`, the layer files and the entries with key, value and origin.

`show` is called from the `!` block every BDK skill starts with, and the host drops a skill whose `!` command exits non-zero without showing its output. `show` SHALL therefore exit 0 for every state of the configuration, with the state in its result:

- not configured: exactly one line, `BDK not configured: run /bdk:setup`, and status `not-configured` naming what is missing (`settings`, `openspec`);
- invalid: the line `BDK configuration invalid: run bdk config check` followed by one line per problem (`<file>: <key>: <message>`), and status `invalid`.

Only usage, environment and internal errors of the CLI frame SHALL give another exit code.

#### Scenario: Values with their origin layer

- **WHEN** the project layer sets `languages: [typescript]` and the local layer sets `models.implementer: sonnet`
- **THEN** `bdk config show` prints `languages: ["typescript"]  # project`, `models.implementer: "sonnet"  # local` and `execution.lead: "background"  # default`, and exits 0

#### Scenario: Not configured

- **WHEN** `bdk config show` runs in a project without `.bdk/settings.yaml`, or without `openspec/`
- **THEN** stdout is exactly `BDK not configured: run /bdk:setup` and a newline, and the exit code is 0

#### Scenario: Invalid configuration

- **WHEN** `bdk config show` runs and the local layer sets `execution.lead: sideways`
- **THEN** stdout starts with `BDK configuration invalid: run bdk config check`, names the local file and `execution.lead`, and the exit code is 0

#### Scenario: JSON result

- **WHEN** `bdk config show --json` runs in a configured project
- **THEN** stdout is one JSON document with `status` `ok` and one entry per leaf with its key, value and origin, valid against the command's output schema

### Requirement: config check

`bdk config check` SHALL validate every layer file that exists and the merged configuration, and SHALL list every problem as `<file>: <key>: <message>`, naming the layer file the offending value comes from and its full dotted key. A value that a higher layer overrides SHALL still be checked. It SHALL exit 0 when it found no problem and 1 when it found any, with the problems as its normal result.

#### Scenario: Invalid value rejected with the key name

- **WHEN** `.bdk/settings.yaml` sets `plan.part.max-files: many`
- **THEN** `bdk config check` prints a problem naming `.bdk/settings.yaml` and `plan.part.max-files`, and exits 1

#### Scenario: Missing required item field

- **WHEN** the only layer defining the `tools.test` item `unit` gives it `scoped` but no `command`
- **THEN** `bdk config check` reports `tools.test.unit.command` as missing and exits 1

#### Scenario: Valid configuration

- **WHEN** every layer file is valid
- **THEN** `bdk config check` exits 0 and prints no problem

#### Scenario: YAML syntax error

- **WHEN** `.bdk/settings.local.yaml` holds a syntax error on line 3
- **THEN** `bdk config check` reports a problem naming that file and line 3, and exits 1

### Requirement: config set

`bdk config set <key> <value> [--layer global|project|local]` SHALL write one key into one layer file, `project` when `--layer` is not given. `<value>` SHALL be read as a YAML value (`5`, `true`, `[a, b]`, `{command: pnpm test}`, a plain string otherwise). A key inside an array merged by `id` SHALL address the item by its `id`, creating the item when the layer does not hold it. The file's comments and the order of its other keys SHALL be kept. `set` SHALL refuse, writing nothing, a key that names no setting (`usage/unknown-key`) and a value that would add a problem to the configuration (`usage/invalid-value`, naming the key and what is allowed), and a layer file it cannot parse (`env/config-invalid`).

#### Scenario: Set a value

- **WHEN** `bdk config set plan.part.max-tasks 7 --layer local` runs
- **THEN** `.bdk/settings.local.yaml` holds `plan.part.max-tasks: 7`, and `bdk config show plan.part.max-tasks` prints `7` with origin `local`

#### Scenario: Invalid value refused

- **WHEN** `bdk config set policy.gates.review sometimes` runs
- **THEN** the CLI reports `usage/invalid-value` naming `policy.gates.review` and the allowed values, exits 2, and the layer file is unchanged

#### Scenario: Item by id

- **WHEN** the project layer holds the `tools.test` item `unit` and `bdk config set tools.test.unit.scoped "pnpm vitest {files}" --layer local` runs
- **THEN** the local file holds a `tools.test` item `unit` with only `scoped`, and the resolved item has the project `command` and the local `scoped`

#### Scenario: Comments kept

- **WHEN** the project file holds a comment line and `bdk config set` changes another key in it
- **THEN** the comment line is still in the file

### Requirement: Configuration reaches skills and agents

A BDK skill SHALL get the resolved configuration from a `!` block running the plugin's `bdk config show` at its start, with that command allowed in its `allowed-tools`. How the block names the command (`bdk` on `PATH` or `${CLAUDE_PLUGIN_ROOT}/bin/bdk`) belongs to the skill tasks. This SHALL hold for a skill preloaded into an agent through the agent's `skills:` field as well: the host resolves the `!` block of a preloaded skill before the agent's first turn (probe on Claude Code 2.1.292, recorded in the design of Change `v3-179-config-layers`), so an agent gets the configuration from its own preloaded skill and its caller SHALL NOT need to pass the configuration in the agent's prompt.

#### Scenario: Preloaded skill

- **WHEN** an agent whose `skills:` preloads a skill starting with a `!` block runs, and the agent has no Bash tool
- **THEN** the agent's context holds the block's output, not the block's command text

#### Scenario: Not configured stops the skill

- **WHEN** a BDK skill starts in a project without a configuration
- **THEN** its context holds the line `BDK not configured: run /bdk:setup` before its first turn, because `bdk config show` exits 0 in that state
