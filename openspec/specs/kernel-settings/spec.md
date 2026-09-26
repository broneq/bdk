# kernel-settings Specification

## Purpose

The settings of BDK v3: the four layer files, how they merge, how keys are named and addressed, the Markdown prompt values, the resolved snapshot, the JSON Schema and its modeline, and the full tree of v3 keys with the type, default, owner task, consumer slice and v2 origin of each. The `config` commands that read and write these files are in `kernel-cli/config`; where the modules live in code is in `kernel-architecture`. A key's owner task registers its module when its consumer lands and may amend its row through a delta; until then the key is declared here and refused by the kernel with the owner's name.

## Requirements

### Requirement: Configuration layers

The kernel SHALL resolve the configuration from four layers, higher wins: bundle defaults < global < project (`.bdk/settings.yaml`) < local (`.bdk/settings.local.yaml`), named `default`, `global`, `project` and `local` in every output.

The global layer file is `$XDG_CONFIG_HOME/bdk/settings.yaml` when `XDG_CONFIG_HOME` is set and absolute, `%APPDATA%\bdk\settings.yaml` on Windows, and `~/.config/bdk/settings.yaml` otherwise. The project root is the directory `findProjectRoot` resolves (the nearest directory holding `.bdk/` up to the work tree root). An absent file is skipped; an empty file is an empty layer. A file that is not valid YAML, or whose top level is not a mapping, answers `policy/config-invalid` naming the file and, for a syntax error, the line. The default layer is the defaults of the registered modules, compiled into the bundle. `.bdk/settings.json` (v2) is never read; `bdk import` (T32) converts it.

#### Scenario: precedence

- **WHEN** the global, project and local files each set `features.lavish` to a different value
- **THEN** `bdk config show features.lavish --origins --json` returns the local value with origin `local`

#### Scenario: XDG_CONFIG_HOME

- **WHEN** `XDG_CONFIG_HOME` points at a directory holding `bdk/settings.yaml`
- **THEN** that file is the global layer and `~/.config/bdk/settings.yaml` is not read

#### Scenario: Windows

- **WHEN** the kernel runs on Windows with `APPDATA` set and `XDG_CONFIG_HOME` unset
- **THEN** the global layer file is `%APPDATA%\bdk\settings.yaml`

#### Scenario: YAML syntax error

- **WHEN** `.bdk/settings.yaml` holds a syntax error on line 3
- **THEN** every `config` command exits 2 with `rule: policy/config-invalid` and `why` naming the file and line 3

### Requirement: Merge

The kernel SHALL merge the layers key by key: mappings deep-merge, arrays whose items are mappings with an `id` merge item by item on `id`, every other array and every scalar is replaced whole by the higher layer.

An item of an `id` array that a higher layer adds is appended in that layer's order; an item it names by an existing `id` is deep-merged into the lower item. Two items with the same `id` in one layer answer `policy/config-invalid`. `null` is a value like any other: it fails a key that is not nullable and never deletes a lower layer's key. A higher layer may set any declared key, including one that disables a policy (full override, D4).

#### Scenario: array merged by id

- **WHEN** the project layer declares `tools.test` items `unit` and `e2e`, and the local layer declares `tools.test` item `unit` with only `scoped`
- **THEN** the resolved `tools.test` holds `unit` with the project fields plus the local `scoped`, followed by `e2e` unchanged

#### Scenario: scalar array replaced

- **WHEN** the project layer sets `languages: [typescript, react]` and the local layer sets `languages: [typescript]`
- **THEN** the resolved `languages` is `[typescript]`

#### Scenario: duplicate id

- **WHEN** one layer lists two `tools.lint` items with the same `id`
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid` naming the `id` and the layer

### Requirement: Key naming and addressing

Every key segment SHALL be kebab-case: lowercase letters, digits and `-`, starting with a letter or digit (`^[a-z0-9][a-z0-9-]*$`), and so SHALL every `id` of an item in an array merged by `id`.

A key is written as a dotted path (`policy.budgets.task-redispatch`). An item of an array merged by `id` is addressed by its `id` as a path segment (`tools.test.unit.scoped`) in every place a dotted key appears: `config show`, `config set`, `why`, `origins`, `overriddenKeys`. A prompt key (requirement "Prompt values") is addressed as `prompts.<prompt key>` (`prompts.rules/security`). An enum value follows the same casing (`host-agent`).

#### Scenario: camelCase key

- **WHEN** `.bdk/settings.yaml` sets `policy.budgets.taskRedispatch`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and the hint `policy.budgets.task-redispatch`

#### Scenario: id that is not a path segment

- **WHEN** a `tools.test` item has `id: unit.fast`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.test` and the id

### Requirement: Registry and consumers

Every key the kernel accepts SHALL be declared by exactly one registered config module, and every module SHALL name the slice that consumes it (S6: no unknown key, no key without a consumer).

A module declares its root key, its zod schema with defaults, a description and its consumer slice, and lives in the consumer slice's `config.ts` (`kernel-architecture`, Slice anatomy); `shared/config` declares the modules it consumes itself. The consumer column of the tables below names that slice; another slice that needs the value reads it through the consumer's `index.ts`, within the dependency matrix. A module is registered by the task that lands its consumer, so the registry holds a subset of the keys this spec declares. Validation is strict and reports every error with the full dotted key, the layer and the file:

- a key this spec declares whose owner task has not registered it answers `policy/unknown-config-key` with `why` naming the owner task (`lands with T22`);
- a removed v2 key (requirement "Removed v2 keys") answers `policy/unknown-config-key` with `why` naming its replacement or the reason it is gone;
- any other key answers `policy/unknown-config-key`, with a "did you mean" hint when a declared key is within edit distance 2;
- a value failing its module answers `policy/config-invalid`.

Two modules declaring the same root key fail the registry at startup. A structural test fails the build when a module names a slice that is not in `kernel-architecture`, Vertical slices, or when the consumer slice has a registered command handler and none of its use cases reads the module. A contract test fails the build when the key tables of this spec and the registry disagree: every registered key is in a table with the same type, default, owner and consumer, and every table key not registered is on the kernel's list of planned keys with the same owner.

#### Scenario: config layering with unknown key

- **WHEN** the global layer is valid and `.bdk/settings.yaml` sets `tools.tests` in a git repository fixture, and `bdk config check --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/unknown-config-key`, and `why` names `tools.tests`, the layer `project`, the file `.bdk/settings.yaml` and the hint `tools.test`

#### Scenario: key of a later task

- **WHEN** `.bdk/settings.yaml` sets `policy.budgets.task-redispatch` before T22 registers the `policy` module
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and `lands with T22`

#### Scenario: key without a consumer

- **WHEN** a module names a consumer slice that has a registered handler but no use case of that slice reads the module
- **THEN** the S6 structural test fails the build

#### Scenario: spec and registry disagree

- **WHEN** a module changes a default without the matching row of this spec changing
- **THEN** the contract test fails naming the key

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

`{files}` is replaced by the consumer with the quoted, space-separated paths. No other field is allowed. v2's `type` becomes `id`; v2 inferred a missing `tier` from the tool name, v3 requires it.

#### Scenario: tool without tier

- **WHEN** a `tools.test` item has no `tier`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.test.<id>.tier`

#### Scenario: template without placeholder

- **WHEN** a `tools.lint` item sets `scoped` without `{files}`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.lint.<id>.scoped`

#### Scenario: when is passed through

- **WHEN** a `tools.test` item sets `when: "only for changes under kernel/"`
- **THEN** `bdk config show tools.test` prints the item with that `when` text unchanged

### Requirement: Keys of the project toolchain

The settings SHALL declare the project toolchain keys below, owned by T12.

| Key               | Type                              | Default | Owner | Consumer | v2 origin                           |
| ----------------- | --------------------------------- | ------- | ----- | -------- | ----------------------------------- |
| `languages`       | array of unique non-empty strings | `[]`    | T12   | `ctx`    | `languages`                         |
| `tools.test`      | array of tool entries             | `[]`    | T12   | `ctx`    | `test-tools` (`type` becomes `id`)  |
| `tools.lint`      | array of tool entries             | `[]`    | T12   | `ctx`    | `lint-tools` (`type` becomes `id`)  |
| `tools.build`     | array of tool entries             | `[]`    | T12   | `ctx`    | `build-tools` (`type` becomes `id`) |
| `features.lavish` | boolean                           | `true`  | T12   | `ctx`    | `features.lavish`                   |

`languages` is free-form: a name gets content only when a `rules/languages/<name>` prompt value exists. `features.lavish: false` makes skills fall back to `AskUserQuestion` (R-11).

#### Scenario: empty project

- **WHEN** no layer file exists and `bdk config show --json` runs
- **THEN** the exit code is 0 and the value holds every registered key with its default

### Requirement: Keys of prompt locations

The settings SHALL declare the prompt location keys below, owned by T12 and consumed by `shared/config` itself (requirement "Prompt values").

`prompts.dir` is a path read from each layer's own file and never inherited; without it a layer uses its default directory: global `<global dir>/prompts/`, project `.bdk/prompts/`, local `.bdk/prompts.local/`.

| Key                   | Type                                        | Default | Owner | Consumer        | v2 origin                                         |
| --------------------- | ------------------------------------------- | ------- | ----- | --------------- | ------------------------------------------------- |
| `prompts.dir`         | non-empty string                            | none    | T12   | `shared/config` | none                                              |
| `prompts.files.<key>` | non-empty string or `{path, mode, applies}` | none    | T12   | `shared/config` | `quality.<category>`, `language-rules.<language>` |

#### Scenario: prompts.dir not inherited

- **WHEN** `.bdk/settings.yaml` sets `prompts.dir: docs/bdk-prompts` and `.bdk/settings.local.yaml` sets no `prompts.dir`
- **THEN** the local layer reads `.bdk/prompts.local/`, not `docs/bdk-prompts`

### Requirement: Keys of workflow policy

The settings SHALL declare the workflow policy keys below. Each is registered by its owner task with its consumer.

| Key                                   | Type                                        | Default                                                                                                                                  | Owner | Consumer   | v2 origin |
| ------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------- | --------- |
| `policy.gates.design`                 | `manual` or `auto`                          | `manual`                                                                                                                                 | T21   | `graph`    | none      |
| `policy.gates.review`                 | `manual` or `auto`                          | `manual`                                                                                                                                 | T21   | `graph`    | none      |
| `policy.budgets.task-redispatch`      | integer >= 0                                | `3`                                                                                                                                      | T22   | `attempt`  | none      |
| `policy.budgets.verify-fix`           | integer >= 0                                | `2`                                                                                                                                      | T22   | `attempt`  | none      |
| `policy.budgets.review-fix`           | integer >= 0                                | `2`                                                                                                                                      | T22   | `attempt`  | none      |
| `policy.budgets.verifier`             | integer >= 0                                | `2`                                                                                                                                      | T22   | `attempt`  | none      |
| `policy.budgets.not-run`              | integer >= 0                                | `3`                                                                                                                                      | T22   | `attempt`  | none      |
| `policy.oscillation.threshold`        | integer >= 1                                | `2`                                                                                                                                      | T22   | `attempt`  | none      |
| `policy.escalation.enabled`           | boolean                                     | `true`                                                                                                                                   | T22   | `attempt`  | none      |
| `policy.escalation.model`             | non-empty string                            | `opus`                                                                                                                                   | T22   | `attempt`  | none      |
| `policy.checkpoint.enabled`           | boolean                                     | `true`                                                                                                                                   | T22   | `change`   | none      |
| `policy.checkpoint.squash-at-close`   | boolean                                     | `false`                                                                                                                                  | T22   | `change`   | none      |
| `policy.verifier.blocking-categories` | array of `{id, description}` merged by `id` | the six P8 categories: `architecture`, `security`, `irreversible-step`, `integration-failure`, `unresolved-decision`, `false-code-claim` | T23   | `dispatch` | none      |
| `policy.log.max-observations`         | integer >= 0                                | `5`                                                                                                                                      | T23   | `log`      | none      |

`policy.gates.<gate>` holds one key per human gate the graph defines; T21 may add a gate through a delta. A project extends the blocking categories by adding items and disables one by replacing the array in a higher layer. `policy.escalation.model` names a model class, not a model id; the dispatch adapter maps it (P11).

#### Scenario: extend the blocking categories

- **WHEN** the `policy` module is registered and `.bdk/settings.yaml` adds a `policy.verifier.blocking-categories` item with `id: accessibility`
- **THEN** the resolved list holds the six default categories followed by `accessibility`

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                     | Type                                                | Default                | Owner | Consumer   | v2 origin |
| ----------------------- | --------------------------------------------------- | ---------------------- | ----- | ---------- | --------- |
| `execution.runner`      | `host-agent` or `headless`                          | detected by `dispatch` | T23   | `dispatch` | none      |
| `execution.concurrency` | integer 1 to 15                                     | `5`                    | T23   | `dispatch` | none      |
| `execution.host`        | `claude`, `codex`, `gemini`, `cursor` or `opencode` | detected by `dispatch` | T23   | `dispatch` | none      |
| `archive.keep-evidence` | boolean                                             | `false`                | T23   | `change`   | none      |

"Detected" means the key has no default in the registry; its consumer decides when no layer sets it, and `config show` answers `input/not-found` for it.

#### Scenario: detected key unset

- **WHEN** the `execution` module is registered, no layer sets `execution.runner` and `bdk config show execution.runner` runs
- **THEN** the exit code is 3 with `rule: input/not-found`, and `dispatch` detects the runner itself

### Requirement: Keys of rules and specs

The settings SHALL declare the rule and spec keys below.

| Key                                  | Type                     | Default | Owner | Consumer | v2 origin |
| ------------------------------------ | ------------------------ | ------- | ----- | -------- | --------- |
| `rules.propose-when.changes`         | integer >= 1             | `2`     | T31   | `rules`  | none      |
| `rules.propose-when.authors`         | integer >= 1             | `2`     | T31   | `rules`  | none      |
| `rules.propose-when.failed-attempts` | integer >= 1             | `1`     | T31   | `rules`  | none      |
| `rules.max-per-package`              | integer >= 1             | `20`    | T31   | `rules`  | none      |
| `rules.max-learnings-per-change`     | integer >= 0             | `10`    | T31   | `log`    | none      |
| `rules.disabled`                     | array of unique rule ids | `[]`    | T31   | `rules`  | none      |
| `spec.normative-word`                | non-empty string         | `SHALL` | T30   | `spec`   | none      |

#### Scenario: out-of-range value

- **WHEN** the `rules` module is registered and `.bdk/settings.yaml` sets `rules.max-per-package: 0`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `rules.max-per-package`

### Requirement: Removed v2 keys

The kernel SHALL refuse a key that v2 had and v3 dropped or renamed with `policy/unknown-config-key`, and `why` SHALL name the replacement or the reason.

| v2 key                       | Replacement or reason                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| `test-tools`                 | `tools.test`                                                           |
| `lint-tools`                 | `tools.lint`                                                           |
| `build-tools`                | `tools.build`                                                          |
| `quality`                    | `prompts.files.rules/<category>` or `.bdk/prompts/rules/<category>.md` |
| `language-rules`             | `prompts.files.rules/languages/<language>`                             |
| `features.caveman`           | no consumer in v3 (#39)                                                |
| `features.serena`            | removed with the bundled MCP servers (ADR-0001)                        |
| `features.code-review-graph` | removed with the bundled MCP servers (ADR-0001)                        |
| `$schema`                    | the yaml-language-server modeline                                      |

#### Scenario: removed key named

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and ADR-0001

### Requirement: Prompt values

Markdown configuration values SHALL be files, one per prompt key, resolved across the same four layers, each layer contributing by `mode: extends` (appended to the value below) or `mode: replace` (discarding it).

A prompt key is the file path relative to a prompts directory without `.md` (`rules/security`), so it never contains a dot; its first segment is never `dir` or `files`. Each layer has one prompts directory, set only by `prompts.dir` in that layer's own file and never inherited; a relative `prompts.dir` resolves against the project root for the project and local layers and against the global layer's directory for the global layer. In the same layer, `prompts.files.<key>` wins over `<dir>/<key>.md`; its string form is a path with `mode: extends`, its object form carries `path`, `mode` and `applies`. A file's optional frontmatter carries `mode` and `applies` (a list of globs); for a file mapped by `prompts.files`, a frontmatter `mode` or `applies` that differs from the YAML entry answers `policy/config-invalid`. The default layer is the plugin file the prompt key declares, when it has one. Prompt keys are registered like YAML keys, as literal keys or as one-segment patterns: a prompts directory file or a `prompts.files` entry whose key is not registered answers `policy/unknown-config-key`. `applies` is validated as a list of globs and passed to the consumer, which interprets it; `ctx` selects rule sets by file and ignores `applies` until T31.

| Prompt key                    | Default file (plugin)                    | Owner | Consumer | v2 origin                 |
| ----------------------------- | ---------------------------------------- | ----- | -------- | ------------------------- |
| `rules/code-quality`          | `rules/code-quality.md`                  | T12   | `ctx`    | `quality.code-quality`    |
| `rules/architecture`          | `rules/architecture.md`                  | T12   | `ctx`    | `quality.architecture`    |
| `rules/design-patterns`       | `rules/design-patterns.md`               | T12   | `ctx`    | `quality.design-patterns` |
| `rules/security`              | `rules/security.md`                      | T12   | `ctx`    | `quality.security`        |
| `rules/engineering-judgment`  | `rules/engineering-judgment.md`          | T12   | `ctx`    | none                      |
| `rules/test-quality`          | `rules/test-quality.md`                  | T12   | `ctx`    | none                      |
| `rules/languages/*`           | `rules/languages/<name>.md` when shipped | T12   | `ctx`    | `language-rules.<name>`   |
| `fragments/decision/lavish`   | `fragments/decision/lavish.md`           | T13   | `ctx`    | none                      |
| `fragments/decision/ask-user` | `fragments/decision/ask-user.md`         | T13   | `ctx`    | none                      |

Later tasks add prompt keys through a delta (the Change kind templates in T21).

#### Scenario: extends then replace

- **WHEN** the plugin default of `rules/security` exists, the project layer has `.bdk/prompts/rules/security.md` with `mode: extends` and the local layer has `.bdk/prompts.local/rules/security.md` with `mode: replace`
- **THEN** the resolved value of `rules/security` is the local file alone, and `bdk config show prompts.rules/security --json` lists only the local file with mode `replace`

#### Scenario: file mapped from anywhere

- **WHEN** `.bdk/settings.yaml` sets `prompts.files.rules/security: docs/security-rules.md` and that file has no frontmatter
- **THEN** the project contribution to `rules/security` is `docs/security-rules.md` with `mode: extends`

#### Scenario: custom directory

- **WHEN** `.bdk/settings.yaml` sets `prompts.dir: docs/bdk-prompts` and `docs/bdk-prompts/rules/architecture.md` exists
- **THEN** that file is the project contribution to `rules/architecture` and `.bdk/prompts/` is not read

#### Scenario: unknown prompt file

- **WHEN** `.bdk/prompts/rules/secrity.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `rules/secrity` and the project layer

#### Scenario: project replaces a fragment

- **WHEN** `.bdk/prompts/fragments/decision/ask-user.md` has `mode: replace`
- **THEN** the resolved value of `fragments/decision/ask-user` is that file alone, and `bdk config show prompts.fragments/decision/ask-user --json` lists only that file

### Requirement: Resolved snapshot

Every successful resolution by `config check` and `config set` in a project that has `.bdk/` SHALL write the resolved configuration and the list of personally overridden keys to `.bdk/.machine/config/resolved.yaml`.

The snapshot holds the merged YAML values, the prompt values as their contributing file paths, and `overriddenKeys`: the dotted names, without values, of every leaf and prompt key that the global or the local layer sets (D4b). The file is a cache: nothing reads it back as input, and deleting it changes no behaviour. Recording the list in a Change is T20's.

#### Scenario: local override visible in the snapshot

- **WHEN** `.bdk/settings.local.yaml` sets `features.lavish: false` and `bdk config check` runs
- **THEN** `.bdk/.machine/config/resolved.yaml` holds `features.lavish: false`, its `overriddenKeys` contains `features.lavish`, and `overriddenKeys` names no key that only the project layer sets

### Requirement: Settings JSON Schema

The JSON Schema of the settings files SHALL be generated from the module registry, committed as `schema/settings.json`, and referenced from every settings file by a versioned yaml-language-server modeline.

`pnpm build` regenerates `schema/settings.json` and CI fails on `git diff --exit-code dist/ schema/`. The schema covers the registered modules only, rejects unknown keys (`additionalProperties: false` at every level) and carries each key's description and default. The modeline is the first line `# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v<version>/schema/settings.json`, where `<version>` is the plugin version the kernel reports; `config set` writes it into a file it creates, `setup` writes it into the file it creates, and `doctor --fix` adds or updates it. The offline copy `.bdk/.machine/schema/settings.json` equals the running kernel's schema after `config check` or `doctor --fix`.

#### Scenario: schema consistent with the registry

- **WHEN** a module's zod schema changes and `schema/settings.json` is not regenerated
- **THEN** CI fails on `git diff --exit-code dist/ schema/`

#### Scenario: IDE suggestions

- **WHEN** the fixture's `.bdk/settings.yaml` with the modeline is opened in an editor running yaml-language-server
- **THEN** the editor suggests the registered keys and flags an unknown key (confirmed by hand once, recorded in the Change's tasks)
