## ADDED Requirements

### Requirement: Tool group nodes

The kinds `tests-scoped` and `tests-full` SHALL belong to the tool group `test`, and `lint` and `lint-full` to the tool group `lint` (`kernel-settings`, Tool entries, Tool group states). A node of a grouped kind SHALL be `skipped` when its group is declared none, with `why: tools.<group> is none` and, for a step collection, no instance, so that a requirement on it is satisfied (Requirement: Node states), the runner package and the review round's gate runner do not list it (`kernel-cli/dispatch`, bdk dispatch build) and `attempt close` does not ask for its evidence. No `not-run` manifest is ever needed for a declared-none group. A configured group's nodes apply as before. An unset group's nodes apply as well, but a Change never reaches them: `bdk change new` and `bdk part start` refuse an unset group with `policy/tools-unset` (`kernel-cli/change`, bdk change new; `kernel-cli/part`, bdk part start). The groups a Change runs are those of the grouped nodes its graph variant applies: with the shipped pipeline every kind runs both groups, through `tests-full` and `lint-full`.

#### Scenario: lint declared none

- **WHEN** `tools.lint` is `none`, `tools.test` is configured, and a `small` feature Change has plan part `01`
- **THEN** `change status --json` lists `lint` and `lint-full` as `skipped` with `why` naming `tools.lint is none` and no `lint:01` instance, `tests-scoped:01` and `tests-full` are not skipped, and `review` lists neither `lint-full` nor a `lint` instance among its requirements

#### Scenario: no lint step in the runner's checks

- **WHEN** `tools.lint` is `none` and the runner package of task `01-1` is built
- **THEN** its `Checks` section names `tests-scoped` and holds no `lint` section, and `attempt close <ticket> ok` succeeds with a passing `tests-scoped` manifest and no `lint` manifest

#### Scenario: test declared none

- **WHEN** `tools.test` is `none`
- **THEN** `tests-scoped` and `tests-full` are `skipped` with `why` naming `tools.test is none`, and `tests-scoped` has no instance
