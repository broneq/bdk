## MODIFIED Requirements

### Requirement: Settings keys

The configuration SHALL accept exactly these keys; any other key at any level SHALL be a problem naming its full dotted key. A key segment, a `steps` orchestrator and an `id` SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`), except a key directly under `rules`, which SHALL be a rule id: letters, digits and `-`, starting with a letter or digit (`^[A-Za-z0-9][A-Za-z0-9-]*$`), case kept. A `models` role SHALL be one of the roles of "Every agent is a models role"; any other role SHALL be an unknown key with the closest role as a suggestion. An item of an array merged by `id` SHALL be addressed by its `id` as a key segment (`tools.test.unit.when`) in every output and argument.

| Key                                                  | Type                                                                                                         | Default      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------ |
| `tools.test`, `tools.lint`, `tools.build`            | items by `id`: `command` (string, required; a `{files}` in it is replaced by the item's files, spec `bdk-cli/check`: the picked tests of `--tests` for a `tools.test` item when given, else the changed and `--scope` files), `when` (non-empty list of distinct points among `part`, `wave` and `review`, optional; `bdk check plan --at <point>` selects the items whose `when` holds the point, and an item without `when` runs at every point), `timeout` (integer seconds, 1 to 86400, optional; `bdk check plan` uses 600 when absent and gives it as the Bash timeout of the item's call), `paths` (non-empty list of non-empty globs, optional; `bdk check plan` gives the item only the files they match, and skips it when none matches); the field `scoped` is removed, and a layer that sets it SHALL get a problem naming `tools.<kind>.<id>.scoped` and the rewrite: put `{files}` into the `command` of a second item that runs at `part` | `[]`         |
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
