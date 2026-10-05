## MODIFIED Requirements

### Requirement: Tool entries

The keys `tools.test`, `tools.lint` and `tools.build` SHALL hold arrays of tool entries merged by `id`, one entry per command the project runs.

**Tool group states (T49).** `tools.test` and `tools.lint` SHALL each be in exactly one of three states: _configured_, a list of one or more entries; _declared none_, the scalar `none`, which says the project has no tool of the group; _unset_, no layer sets the key. Neither key has a default. An empty list is `policy/config-invalid` naming the key, with a message that names `none`, so each state has one spelling. The merge treats `none` as a scalar: a higher layer's `none` replaces a lower layer's list, and a higher layer's list over a lower `none` starts from no entries. `bdk config set tools.<group> none` writes the declared-none state, and `bdk config set tools.<group>.<id> '{...}'` over a `none` replaces it with a one-entry list. An item of a configured group stays addressable by its id (`tools.test.unit.scoped`). `tools.build` keeps the list form with the default `[]`: no pipeline node runs it. What each state does to a Change is in `kernel-pipeline`, Tool group nodes.

| Field         | Type                            | Required                                                                                 | Meaning                                                                                    |
| ------------- | ------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`          | kebab-case string               | yes                                                                                      | Unique within the array; the merge and path segment.                                       |
| `tier`        | enum                            | `test`: `fast` or `e2e`; `lint`: `lint`, `format` or `typecheck`; not allowed in `build` | Cost class the runner role picks by.                                                       |
| `command`     | non-empty string                | yes                                                                                      | The full, unscoped form.                                                                   |
| `scoped`      | non-empty string with `{files}` | no                                                                                       | The command for given paths.                                                               |
| `related`     | non-empty string with `{files}` | no                                                                                       | The command for the tests covering given source paths.                                     |
| `failed`      | non-empty string                | no                                                                                       | Re-run of the previous failures.                                                           |
| `incremental` | non-empty string                | no                                                                                       | Incremental form (a type checker's watch-free incremental run).                            |
| `when`        | non-empty string                | no                                                                                       | Free text telling the model when this entry is the right one to run; passed through as is. |
| `coverage`    | object                          | no; only in `tools.test`                                                                 | How this test type measures coverage (T42); see below.                                     |

`{files}` is replaced by the consumer with the quoted, space-separated paths. `coverage` holds `command` (non-empty string, required: the full run that writes the report), `report` (non-empty repository-relative path, required: where the command writes it), `format` (`lcov` or `cobertura`, required) and `min` (number from 0 to 100, optional: the threshold for the coverage of the lines a Change adds, `kernel-cli/evidence`, bdk evidence coverage); each test type carries its own, so unit and E2E tests can use different coverage tools and thresholds. No other field is allowed, in the entry or in `coverage`. v2's `type` becomes `id`; v2 inferred a missing `tier` from the tool name, v3 requires it.

#### Scenario: tool without tier

- **WHEN** a `tools.test` item has no `tier`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.test.<id>.tier`

#### Scenario: template without placeholder

- **WHEN** a `tools.lint` item sets `scoped` without `{files}`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.lint.<id>.scoped`

#### Scenario: when is passed through

- **WHEN** a `tools.test` item sets `when: "only for changes under kernel/"`
- **THEN** `bdk config show tools.test` prints the item with that `when` text unchanged

#### Scenario: coverage per test type

- **WHEN** `tools.test` holds `unit` with `coverage: {command: "vitest run --coverage", report: coverage/lcov.info, format: lcov, min: 90}` and `e2e` with `coverage: {command: "playwright test", report: coverage/cobertura.xml, format: cobertura}`
- **THEN** `bdk config check` exits 0 and `bdk config show tools.test --json` holds both `coverage` objects unchanged

#### Scenario: coverage outside tools.test

- **WHEN** a `tools.lint` item carries `coverage`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming keys under `tools.lint.<id>.coverage`

#### Scenario: declared none

- **WHEN** `bdk config set tools.lint none` runs in a project without `tools.lint`
- **THEN** the exit code is 0, `.bdk/settings.yaml` holds `lint: none` under `tools`, and `bdk config show tools.lint --json` answers `none`

#### Scenario: empty group

- **WHEN** a layer sets `tools.lint: []`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.lint`, and `why` names `none`

#### Scenario: entry over none

- **WHEN** the project layer holds `tools.lint: none` and `bdk config set tools.lint.eslint '{tier: lint, command: eslint .}'` runs
- **THEN** the exit code is 0 and `bdk config show tools.lint --json` holds the one entry `eslint`

#### Scenario: local none over project entries

- **WHEN** the project layer lists `tools.lint` entry `eslint` and the local layer sets `tools.lint: none`
- **THEN** the resolved `tools.lint` is `none`

#### Scenario: threshold out of range

- **WHEN** a `coverage.min` is 120 or `coverage.format` is `jacoco`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming the field

### Requirement: Keys of the project toolchain

The settings SHALL declare the project toolchain keys below, owned by T12.

| Key               | Type                              | Default | Owner | Consumer        | v2 origin                           |
| ----------------- | --------------------------------- | ------- | ----- | --------------- | ----------------------------------- |
| `languages`       | array of unique non-empty strings | `[]`    | T12   | `rules`         | `languages`                         |
| `tools.test`      | `none` or array of tool entries   | none    | T12   | `shared/config` | `test-tools` (`type` becomes `id`)  |
| `tools.lint`      | `none` or array of tool entries   | none    | T12   | `shared/config` | `lint-tools` (`type` becomes `id`)  |
| `tools.build`     | array of tool entries             | `[]`    | T12   | `shared/config` | `build-tools` (`type` becomes `id`) |
| `features.lavish` | boolean                           | `true`  | T12   | `ctx`           | `features.lavish`                   |

`languages` is free-form: a name gets rules only when the bundle ships a pack under `rules/languages/<name>/` (`rule-pack`, Pack layout); a project's own language rules are ordinary rule files with `applies`. The `rules` slice owns the rule text (`kernel-architecture`, Dependency matrix), and `ctx` reads it through `rules`. `features.lavish: false` makes skills fall back to `AskUserQuestion` (R-11). The `tools` module is declared by `shared/config` (`shared/config/modules.ts`), not by one slice: `ctx` renders the entries into skill context, `dispatch` into a runner's `Checks`, `evidence` reads `tools.test[].coverage` for `bdk evidence coverage` and `graph` for the `tests-full` node, and `evidence` stays a leaf (T42).

#### Scenario: empty project

- **WHEN** no layer file exists and `bdk config show --json` runs
- **THEN** the exit code is 0 and the value holds every registered key with its default; `tools.test` and `tools.lint`, which have none, are absent
