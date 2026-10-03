## MODIFIED Requirements

### Requirement: Tool entries

The keys `tools.test`, `tools.lint` and `tools.build` SHALL hold arrays of tool entries merged by `id`, one entry per command the project runs.

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

#### Scenario: threshold out of range

- **WHEN** a `coverage.min` is 120 or `coverage.format` is `jacoco`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming the field

## ADDED Requirements

### Requirement: Keys of review policy

The settings SHALL declare the review keys below, registered as the module `review.group` with consumer `review` and the module `review.risks` with consumer `dispatch` (T42).

| Key                      | Type             | Default                                                      | Owner | Consumer   | v2 origin |
| ------------------------ | ---------------- | ------------------------------------------------------------ | ----- | ---------- | --------- |
| `review.group.max-files` | integer 5 to 200 | `30`                                                         | T42   | `review`   | none      |
| `review.risks`           | array of risks   | `auth`, `migration`, `secrets`, `public-api`, `dependencies` | T42   | `dispatch` | none      |

`review.group.max-files` is the size above which `bdk review plan` splits a group by module; a logical group (a plan part) stays one group up to it (T42-R1). `review.risks` is an array of risks `{id, instruction, enabled}` merged by `id`. It describes what a reviewer must call out as risky for this project, as instructions to a model rather than paths: `id` is kebab-case, `instruction` a non-empty string of at most 500 characters, `enabled` a boolean defaulting to `true`. Items merge by `id` like tool entries, so a project replaces a default's `instruction`, turns one off with `enabled: false`, or adds its own. The defaults are:

| `id`           | `instruction`                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `auth`         | Changes to authentication, authorisation, permissions, roles or session handling, including who may call a changed endpoint.   |
| `migration`    | Changes to a persistent data model: schema migrations, stored formats, data backfills, anything hard to roll back.             |
| `secrets`      | Code or configuration that reads, stores, logs or transmits secrets, tokens, keys or personal data.                            |
| `public-api`   | Changes to a public or cross-service interface: endpoints, exported functions, CLI flags, events, file formats others consume. |
| `dependencies` | Added, removed or upgraded third-party dependencies and changes to build or deployment configuration.                          |

The `integration-reviewer` package lists the enabled items (`kernel-cli/dispatch`, bdk dispatch build).

#### Scenario: review defaults

- **WHEN** no layer sets `review` and `bdk config show review --json` runs
- **THEN** the exit code is 0, `group.max-files` is 30 and `risks` holds the five defaults, each with `enabled: true`

#### Scenario: project risk merged by id

- **WHEN** `.bdk/settings.yaml` sets `review.risks: [{id: auth, instruction: "Any change under src/acl/ or to the Role enum"}, {id: dependencies, enabled: false}, {id: billing, instruction: "Anything that computes or stores a price"}]`
- **THEN** the resolved `risks` holds `auth` with the project instruction, `dependencies` with `enabled: false`, the other defaults unchanged and `billing` last

#### Scenario: group size out of range

- **WHEN** `review.group.max-files` is 2
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `review.group.max-files`
