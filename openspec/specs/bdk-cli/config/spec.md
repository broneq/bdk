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

- **WHEN** the project layer declares `tools.test` items `unit` and `e2e`, and the local layer declares a `tools.test` item `unit` with only `when: [part]`
- **THEN** the resolved `tools.test` holds `unit` with the project fields plus the local `when`, followed by `e2e` unchanged

#### Scenario: Scalar array replaced

- **WHEN** the project layer sets `languages: [typescript, react]` and the local layer sets `languages: [typescript]`
- **THEN** the resolved `languages` is `[typescript]`

#### Scenario: Duplicate id

- **WHEN** one layer lists two `tools.lint` items with the same `id`
- **THEN** `bdk config check` reports a problem naming that layer's file, `tools.lint` and the `id`

### Requirement: Settings keys

The configuration SHALL accept exactly these keys; any other key at any level SHALL be a problem naming its full dotted key. A key segment, a `steps` orchestrator and an `id` SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`), except a key directly under `rules`, which SHALL be a rule id: letters, digits and `-`, starting with a letter or digit (`^[A-Za-z0-9][A-Za-z0-9-]*$`), case kept. A `models` role SHALL be one of the roles of "Every agent is a models role"; any other role SHALL be an unknown key with the closest role as a suggestion. An item of an array merged by `id` SHALL be addressed by its `id` as a key segment (`tools.test.unit.when`) in every output and argument.

| Key                                                  | Type                                                                                                         | Default      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| `tools.test`, `tools.lint`, `tools.build`            | items by `id`: `command` (string, required; a `{files}` in it is replaced by the changed files, spec `bdk-cli/check`), `when` (non-empty list of distinct points among `part`, `wave` and `review`, optional; `bdk check run --at <point>` selects the items whose `when` holds the point, and an item without `when` runs at every point), `timeout` (integer seconds, 1 to 86400, optional; `bdk check run` uses 600 when absent), `paths` (non-empty list of non-empty globs, optional; `bdk check run` gives the item only the changed files they match, and skips it when none matches); the field `scoped` is removed, and a layer that sets it SHALL get a problem naming `tools.<kind>.<id>.scoped` and the rewrite: put `{files}` into the `command` of a second item that runs at `part` | `[]`         |
| `tools.e2e`                                          | items by `id`: `start` (command), `ready` (URL or command), `driver` (`cli`, `http`, `browser`), `env` (map of variable name to string, optional), `browser` (`playwright` or `chrome-devtools-mcp`, optional; read only for `driver: browser`, where an absent field means `playwright`); all but `env` and `browser` required | `[]`         |
| `languages`                                          | list of kebab-case names                                                                                     | `[]`         |
| `models.<role>.model`, `models.<role>.effort`       | mapping per role, both fields optional: `model` (model name or alias the role's agent runs on), `effort` (`low`, `medium`, `high`, `xhigh` or `max`); a string value for a role is a problem naming the `model` field | none set     |
| `rules.<id>`                                         | rule entry (spec `rule-pack`, "Project rules" and "Switching rules off"): `text` (string), `file` (path), `kind` (`house`, `knowledge`), `paths` (non-empty list of strings), `stages` (non-empty list of distinct `design`, `plan`, `execute`, `review`), `source` (string), `verified` (date `YYYY-MM-DD`), `enabled` (boolean), all optional in one layer; a resolved entry whose id does not start with `BDK-` SHALL hold exactly one of `text` and `file`, and `source` and `verified` when its `kind` is `knowledge` and only then; a resolved entry whose id starts with `BDK-` SHALL hold no field but `enabled`, `paths` and `stages` | `{}` |
| `policy.gates.design`, `policy.gates.review`         | `manual` or `auto`                                                                                           | `manual`     |
| `policy.questions`                                   | `decide-and-record` or `stop`                                                                                | `stop`       |
| `policy.budgets.part-attempts`, `policy.budgets.review-rounds` | integer, at least 1                                                                                 | `3`, `3`     |
| `policy.budgets.verifier`                           | integer, at least 1: the most verifier passes one design or plan orchestrator run spends                     | `3`          |
| `policy.escalation.model`                            | model a blocked part is retried with                                                                         | `opus`       |
| `policy.escalation.effort`                           | `low`, `medium`, `high`, `xhigh` or `max`: effort of the escalated implementer run; when absent the run takes `models.implementer.effort` | none set     |
| `plan.part.max-tasks`, `plan.part.max-files`, `plan.part.max-bytes` | integer, at least 1                                                                           | `5`, `10`, `8192` |
| `steps.<orchestrator>`                               | items by `id`: `enabled` (boolean, optional), `use` (project skill or agent replacing the block, optional)    | none set     |
| `execution.lead`                                     | `background` or `foreground`                                                                                 | `background` |
| `execution.max-parallel`                             | integer, at least 1: the most part agents the execute lead runs at once                                      | `10`         |
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

#### Scenario: Check paths

- **WHEN** `.bdk/settings.yaml` gives the `tools.test` item `api` the field `paths: ["api/**"]` and the `tools.lint` item `ruff` the field `paths: []`
- **THEN** `bdk config check` accepts `tools.test.api.paths`, reports `tools.lint.ruff.paths` and that it must hold at least one glob, and exits 1

#### Scenario: Check points of an item

- **WHEN** `.bdk/settings.yaml` gives the `tools.test` item `unit` the field `when: [wave, review]`, the item `fast` the field `when: [part, part]`, and the item `e2e` the field `when: [merge]`
- **THEN** `bdk config check` accepts `tools.test.unit.when`, reports `tools.test.fast.when` and that it must not repeat a point, reports `tools.test.e2e.when` with the allowed points `part`, `wave` and `review`, and exits 1

#### Scenario: Removed scoped field

- **WHEN** `.bdk/settings.yaml` gives the `tools.lint` item `eslint` the field `scoped: pnpm eslint {files}`
- **THEN** `bdk config check` reports `tools.lint.eslint.scoped`, its message names that `scoped` was removed and that `{files}` goes into the `command` of a second item that runs at `part`, and exits 1

#### Scenario: Browser tool of an E2E entry

- **WHEN** `.bdk/settings.yaml` gives the `tools.e2e` item `web` the field `browser: playwright`, the item `docs` the field `browser: chrome-devtools-mcp`, and the item `admin` the field `browser: chrome-devtools-axi`
- **THEN** `bdk config check` accepts `tools.e2e.web.browser` and `tools.e2e.docs.browser`, reports `tools.e2e.admin.browser` with the allowed values `playwright` and `chrome-devtools-mcp`, and exits 1

#### Scenario: Browser tool absent

- **WHEN** the `tools.e2e` item `web` has `driver: browser` and no `browser` field
- **THEN** `bdk config check` exits 0 and `bdk config show tools.e2e.web` prints no `browser` value, which the tester reads as `playwright`

#### Scenario: Verifier budget

- **WHEN** no layer sets `policy.budgets.verifier` and the project layer sets nothing under `policy`
- **THEN** `bdk config show policy.budgets.verifier` prints 3 with origin `default`, and `policy.budgets.verifier: 0` in a layer makes `bdk config check` report `policy.budgets.verifier` and exit 1

#### Scenario: Wave size limit

- **WHEN** no layer sets `execution.max-parallel`, and later the local layer sets `execution.max-parallel: 0`
- **THEN** `bdk config show execution.max-parallel` first prints 10 with origin `default`, then `bdk config check` reports `execution.max-parallel` and that it must be at least 1, and exits 1

#### Scenario: Model and effort of a role

- **WHEN** `.bdk/settings.yaml` sets `models.implementer: { model: opus, effort: high }` and `policy.escalation.effort: max`
- **THEN** `bdk config check` exits 0, and `bdk config show models` prints `models.implementer.model: "opus"  # project` and `models.implementer.effort: "high"  # project`

#### Scenario: Unknown effort

- **WHEN** `.bdk/settings.yaml` sets `models.planner.effort: extreme`
- **THEN** `bdk config check` reports `models.planner.effort` with the allowed values `low`, `medium`, `high`, `xhigh` and `max`, and exits 1

#### Scenario: Unknown role

- **WHEN** `.bdk/settings.yaml` sets `models.implementor.model: opus`
- **THEN** `bdk config check` reports `models.implementor` as an unknown key, suggests `models.implementer`, and exits 1

#### Scenario: Model as a plain string

- **WHEN** `.bdk/settings.yaml` sets `models.reviewer: sonnet`
- **THEN** `bdk config check` reports `models.reviewer` and that it must be a mapping with `model` and `effort`, and exits 1

#### Scenario: Set the effort of a role

- **WHEN** `bdk config set models.designer.effort xhigh` runs in a configured project
- **THEN** `.bdk/settings.yaml` holds `models.designer.effort: xhigh` and the exit code is 0

#### Scenario: Rule id keeps its case

- **WHEN** `bdk config set rules.API-1.enabled false --layer local` runs in a project whose project layer declares `rules: {API-1: {text: "Parse the body."}}`
- **THEN** the local file holds `rules: {API-1: {enabled: false}}`, and `bdk config show rules.API-1` prints `rules.API-1.text` with origin `project` and `rules.API-1.enabled` with origin `local`

#### Scenario: Text and file both set

- **WHEN** the project layer declares `rules: {API-1: {text: "...", file: docs/api.md}}`
- **THEN** `bdk config check` reports `rules.API-1` and that a rule holds exactly one of `text` and `file`, and exits 1

#### Scenario: Pack rule given a text

- **WHEN** the project layer declares `rules: {BDK-CQ-1: {text: "Short names are fine."}}`
- **THEN** `bdk config check` reports `rules.BDK-CQ-1.text` and that a `BDK-` entry takes only `enabled`, `paths` and `stages`, and exits 1

#### Scenario: Knowledge rule without source

- **WHEN** the project layer declares `rules: {PYD-1: {kind: knowledge, verified: 2026-10-01, text: "..."}}`
- **THEN** `bdk config check` reports `rules.PYD-1.source` as missing and exits 1

#### Scenario: Removed rules.disabled

- **WHEN** the project layer still sets `rules: {disabled: [BDK-DP-2]}`
- **THEN** `bdk config check` reports a problem under `rules.disabled` and exits 1

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

- **WHEN** the project layer sets `languages: [typescript]` and the local layer sets `models.implementer.model: sonnet`
- **THEN** `bdk config show` prints `languages: ["typescript"]  # project`, `models.implementer.model: "sonnet"  # local` and `execution.lead: "background"  # default`, and exits 0

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

- **WHEN** the only layer defining the `tools.test` item `unit` gives it `when` but no `command`
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

- **WHEN** the project layer holds the `tools.test` item `unit` and `bdk config set tools.test.unit.when "[part]" --layer local` runs
- **THEN** the local file holds a `tools.test` item `unit` with only `when`, and the resolved item has the project `command` and the local `when`

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

### Requirement: Every settings key has a description
The settings schema SHALL hold a one-sentence description for every key of the Settings keys table, including each field of an item addressed by `id` (`tools.test.<id>.command`) and the value of a record key (`models.<role>`, `steps.<orchestrator>`). The description SHALL be the text the settings Reference shows for the key; there SHALL be no second place that describes a key for users. Every top-level key SHALL also carry at least one example value, and every example SHALL be valid settings. A workspace test SHALL fail and name the key when a key has no description, when a top-level key has no example, or when an example is not valid.

#### Scenario: New key without a description
- **WHEN** a contributor adds `execution.timeout` to the settings schema without a description
- **THEN** `pnpm check` fails and names `execution.timeout`

#### Scenario: Invalid example
- **WHEN** the example of `policy` sets `questions: ask`
- **THEN** `pnpm check` fails and names `policy` and the example

#### Scenario: Description reaches the Reference
- **WHEN** the description of `policy.budgets.review-rounds` changes in the settings schema and the Reference is regenerated
- **THEN** the settings Reference page shows the new description for `policy.budgets.review-rounds`

### Requirement: Every agent is a models role

Every agent the `bdk` plugin ships (`plugins/bdk/agents/<name>.md`) SHALL be a role of `models`, named by the agent's file name: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester`, `judge`, `designer`, `planner` and `analyst`; the schema SHALL accept exactly these roles. The description of `models` in the settings schema SHALL name every one of them. Every skill of the plugin that starts one of these agents SHALL set the `Agent` call's `model` to `models.<agent>.model` and its `effort` to `models.<agent>.effort`, each only when the configuration sets it, and leave the field out when it does not, so the agent runs on the model of its frontmatter (the session's model for `model: inherit`) and at the session's effort level; the only exception SHALL be the last implementer run of a plan part and the second `resolve-conflict` run, which run on `policy.escalation.model` and `policy.escalation.effort` (spec `bdk-execute`). A workspace test SHALL fail and name the agent when an agent file is not a role of the `models` description or of the schema, and SHALL fail and name the skill when a paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` does not name `models.<agent>`.

#### Scenario: Verifier model in every stage

- **WHEN** the configuration sets `models.verifier.model: sonnet` and `/bdk:design`, `/bdk:plan` and `/bdk:close` start their verifier
- **THEN** each `Agent` call with `subagent_type: "bdk:verifier"` has `model` `sonnet`

#### Scenario: Explorer model

- **WHEN** the configuration sets `models.explorer.model: sonnet` and `/bdk:design` maps the code of a Change
- **THEN** the `Agent` call with `subagent_type: "bdk:explorer"` has `model` `sonnet`

#### Scenario: Role not set

- **WHEN** the configuration sets no `models.explorer`
- **THEN** the `Agent` call with `subagent_type: "bdk:explorer"` has neither `model` nor `effort`, and the explorer runs on `haiku`, the model of its frontmatter

#### Scenario: Implementer with model and effort

- **WHEN** the configuration sets `models.implementer.model: sonnet` and `models.implementer.effort: low`, and a user types `/bdk:implement-part add-csv-export 01`
- **THEN** the `Agent` call that starts `bdk:implementer` has `model` `sonnet` and `effort` `low`

#### Scenario: Effort without a model

- **WHEN** the configuration sets only `models.reviewer.effort: high`
- **THEN** every `Agent` call that starts `bdk:reviewer` has `effort` `high` and no `model`

#### Scenario: New agent without a role

- **WHEN** a contributor adds `plugins/bdk/agents/stylist.md` and leaves the `models` description unchanged
- **THEN** `pnpm check` fails and names `stylist`

#### Scenario: Agent call without its model

- **WHEN** a skill starts `subagent_type: "bdk:verifier"` in a paragraph that does not name `models.verifier`
- **THEN** `pnpm check` fails and names that skill

#### Scenario: Analyst model

- **WHEN** the configuration sets `models.analyst.model: opus` and a user types `/bdk:diagnose-run add-total`
- **THEN** the `Agent` call that starts `bdk:analyst` has `model` `opus`
