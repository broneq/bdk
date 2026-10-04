## MODIFIED Requirements

### Requirement: Keys of review policy

The settings SHALL declare the review keys below (T42):

- the module `review.group`, with consumer `review`;
- the module `review.risks`, with consumer `review`; `dispatch` reads it too, for the integration reviewer's package;
- the module `tracker`, with consumer `review`.

| Key                      | Type             | Default                                                                       | Owner | Consumer | v2 origin |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------- | ----- | -------- | --------- |
| `review.group.max-files` | integer 5 to 200 | `30`                                                                          | T42   | `review` | none      |
| `review.risks`           | array of risks   | `auth`, `migration`, `secrets`, `public-api`, `dependencies`, `configuration` | T42   | `review` | none      |
| `tracker`                | tracker object   | none                                                                          | T42   | `review` | none      |

**`review.group.max-files`** is the size above which `bdk review plan` splits a group by module. A logical group (a plan part) stays one group up to it (T42-R1).

**`review.risks`** is an array of risks `{id, instruction, paths, enabled}`, merged by `id`. It describes what a reviewer must call out as risky for this project:

- `id` is kebab-case.
- `instruction` is a non-empty string of at most 500 characters. It is written for a model.
- `paths` is an optional array of unique non-empty globs. The report's change map uses it (`kernel-cli/review`, bdk review render). Globs match paths relative to the project root; `*` stays within one path segment and `**` crosses segments.
- `enabled` is a boolean that defaults to `true`.

Items merge by `id` like tool entries, so a project replaces a default's `instruction` or `paths`, turns one off with `enabled: false`, or adds its own. The defaults are:

| `id`            | `instruction`                                                                                                                  | `paths`                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`          | Changes to authentication, authorisation, permissions, roles or session handling, including who may call a changed endpoint.   | `**/*auth*/**`, `**/*auth*`, `**/*permission*`, `**/*acl*`, `**/*role*`, `**/*session*`                                                                                                                                                                                                                   |
| `migration`     | Changes to a persistent data model: schema migrations, stored formats, data backfills, anything hard to roll back.             | `**/migrations/**`, `**/migrate/**`, `**/*migration*`, `**/*.sql`, `**/*.prisma`, `**/models/**`, `**/entities/**`                                                                                                                                                                                        |
| `secrets`       | Code or configuration that reads, stores, logs or transmits secrets, tokens, keys or personal data.                            | `**/.env*`, `**/*secret*`, `**/*credential*`, `**/*token*`, `**/*.pem`, `**/*.key`                                                                                                                                                                                                                        |
| `public-api`    | Changes to a public or cross-service interface: endpoints, exported functions, CLI flags, events, file formats others consume. | `**/api/**`, `**/routes/**`, `**/controllers/**`, `**/handlers/**`, `**/*.proto`, `**/*.graphql`, `**/openapi*`, `**/swagger*`                                                                                                                                                                            |
| `dependencies`  | Added, removed or upgraded third-party dependencies and changes to the build.                                                  | `**/package.json`, `**/pnpm-lock.yaml`, `**/package-lock.json`, `**/yarn.lock`, `**/pyproject.toml`, `**/uv.lock`, `**/poetry.lock`, `**/requirements*.txt`, `**/go.mod`, `**/go.sum`, `**/Cargo.toml`, `**/Cargo.lock`, `**/Gemfile*`, `**/pom.xml`, `**/build.gradle*`, `**/Makefile`, `**/Dockerfile*` |
| `configuration` | Changes to runtime or deployment configuration: settings files, environment variables, feature flags, CI and infrastructure.   | `**/config/**`, `**/*config.*`, `**/settings*.*`, `**/*.ini`, `**/.env*`, `.github/workflows/**`, `**/helm/**`, `**/k8s/**`, `**/*.tf`                                                                                                                                                                    |

The `integration-reviewer` package lists the enabled items by `id` and `instruction` (`kernel-cli/dispatch`, bdk dispatch build). The report's change map lists the changed files that an enabled item's `paths` match.

**`tracker`** names where a finding goes when the human chooses `track` in the report, or `tracker` on the pull request page. It is an object of one of two kinds:

- `{kind: github}`: the skills file the issue with `gh issue create` in the repository of the `origin` remote, or of the reviewed pull request.
- `{kind: instruction, instruction: <text>}`: `instruction` is a non-empty string of at most 1000 characters. It tells the model how to file the issue with the user's own CLI or MCP server, for example "Create a Jira issue in project PAY with the jira CLI and return its key" (T42-J).

A missing `instruction` with `kind: instruction`, and any other `kind`, are `policy/config-invalid`; `instruction` with `kind: github` is `policy/unknown-config-key`. While `tracker` is unset, nothing offers `track`. `/bdk:setup` proposes the value (`stage-skills`, setup detects the tracker).

#### Scenario: review defaults

- **WHEN** no layer sets `review` and `bdk config show review --json` runs
- **THEN** the exit code is 0, `group.max-files` is 30, and `risks` holds the six defaults, each with `enabled: true` and its `paths`

#### Scenario: project risk merged by id

- **WHEN** `.bdk/settings.yaml` sets `review.risks: [{id: auth, instruction: "Any change under src/acl/ or to the Role enum", paths: ["src/acl/**"]}, {id: dependencies, enabled: false}, {id: billing, instruction: "Anything that computes or stores a price"}]`
- **THEN** the resolved `risks` holds:
  - `auth` with the project instruction and `paths: ["src/acl/**"]`;
  - `dependencies` with `enabled: false`;
  - the other defaults unchanged;
  - `billing` last, without `paths`.

#### Scenario: group size out of range

- **WHEN** `review.group.max-files` is 2
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `review.group.max-files`

#### Scenario: tracker unset by default

- **WHEN** no layer sets `tracker` and `bdk config show tracker --json` runs
- **THEN** the exit code is 3 with `rule: input/not-found`, as for any declared key without a default, and nothing offers `track`

#### Scenario: instruction tracker needs its instruction

- **WHEN** `.bdk/settings.yaml` sets `tracker: {kind: instruction}`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tracker.instruction`
