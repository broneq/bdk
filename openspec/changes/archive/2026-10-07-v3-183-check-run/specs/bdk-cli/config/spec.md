## MODIFIED Requirements

### Requirement: Settings keys

The configuration SHALL accept exactly these keys; any other key at any level SHALL be a problem naming its full dotted key. A key segment, a `models` role, a `steps` orchestrator and an `id` SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`). An item of an array merged by `id` SHALL be addressed by its `id` as a key segment (`tools.test.unit.scoped`) in every output and argument.

| Key                                                  | Type                                                                                                         | Default      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| `tools.test`, `tools.lint`, `tools.build`            | items by `id`: `command` (string, required), `scoped` (string holding `{files}`, optional), `timeout` (integer seconds, 1 to 86400, optional; `bdk check run` uses 600 when absent) | `[]`         |
| `tools.e2e`                                          | items by `id`: `start` (command), `ready` (URL or command), `driver` (`cli`, `http`, `browser`), `env` (map of variable name to string, optional); all but `env` required | `[]`         |
| `languages`                                          | list of kebab-case names                                                                                     | `[]`         |
| `rules.disabled`                                     | list of rule names                                                                                           | `[]`         |
| `models.<role>`                                      | model name or alias                                                                                          | none set     |
| `policy.gates.design`, `policy.gates.review`         | `manual` or `auto`                                                                                           | `manual`     |
| `policy.questions`                                   | `decide-and-record` or `stop`                                                                                | `stop`       |
| `policy.budgets.part-attempts`, `policy.budgets.review-rounds` | integer, at least 1                                                                                 | `3`, `3`     |
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

