## MODIFIED Requirements

### Requirement: Settings keys

The configuration SHALL accept exactly these keys; any other key at any level SHALL be a problem naming its full dotted key. A key segment, a `steps` orchestrator and an `id` SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`). A `models` role SHALL be one of the roles of "Every agent is a models role"; any other role SHALL be an unknown key with the closest role as a suggestion. An item of an array merged by `id` SHALL be addressed by its `id` as a key segment (`tools.test.unit.scoped`) in every output and argument.

| Key                                                  | Type                                                                                                         | Default      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| `tools.test`, `tools.lint`, `tools.build`            | items by `id`: `command` (string, required), `scoped` (string holding `{files}`, optional), `timeout` (integer seconds, 1 to 86400, optional; `bdk check run` uses 600 when absent), `paths` (non-empty list of non-empty globs, optional; with `--scope`, `bdk check run` gives the item only the scope paths they match) | `[]`         |
| `tools.e2e`                                          | items by `id`: `start` (command), `ready` (URL or command), `driver` (`cli`, `http`, `browser`), `env` (map of variable name to string, optional), `browser` (`playwright` or `chrome-devtools-mcp`, optional; read only for `driver: browser`, where an absent field means `playwright`); all but `env` and `browser` required | `[]`         |
| `languages`                                          | list of kebab-case names                                                                                     | `[]`         |
| `rules.disabled`                                     | list of rule names                                                                                           | `[]`         |
| `models.<role>.model`, `models.<role>.effort`       | mapping per role, both fields optional: `model` (model name or alias the role's agent runs on), `effort` (`low`, `medium`, `high`, `xhigh` or `max`); a string value for a role is a problem naming the `model` field | none set     |
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

### Requirement: Every agent is a models role

Every agent the `bdk` plugin ships (`plugins/bdk/agents/<name>.md`) SHALL be a role of `models`, named by the agent's file name: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester`, `judge`, `designer` and `planner`; the schema SHALL accept exactly these roles. The description of `models` in the settings schema SHALL name every one of them. Every skill of the plugin that starts one of these agents SHALL set the `Agent` call's `model` to `models.<agent>.model` and its `effort` to `models.<agent>.effort`, each only when the configuration sets it, and leave the field out when it does not, so the agent runs on the model of its frontmatter (the session's model for `model: inherit`) and at the session's effort level; the only exception SHALL be the last implementer run of a plan part and the second `resolve-conflict` run, which run on `policy.escalation.model` and `policy.escalation.effort` (spec `bdk-execute`). A workspace test SHALL fail and name the agent when an agent file is not a role of the `models` description or of the schema, and SHALL fail and name the skill when a paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` does not name `models.<agent>`.

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
