## MODIFIED Requirements

### Requirement: Registry and consumers

Every key the kernel accepts SHALL be declared by exactly one registered config module, and every module SHALL name the slice that consumes it (S6: no unknown key, no key without a consumer).

A module declares its key, its zod schema with defaults, a description and its consumer slice, and lives in the consumer slice's `config.ts` (`kernel-architecture`, Slice anatomy); `shared/config` and `shared/store` declare the modules they consume themselves, in `shared/config/modules.ts` and `shared/<module>/config.ts`. The consumer column of the tables below names that slice; another slice that needs the value reads it through the consumer's `index.ts`, within the dependency matrix. A module is registered by the task that lands its consumer, so the registry holds a subset of the keys this spec declares. Validation is strict and reports every error with the full dotted key, the layer and the file:

- a key this spec declares whose owner task has not registered it answers `policy/unknown-config-key` with `why` naming the owner task (`lands with Tnn`); after T31 no declared key is waiting for its owner, and the mechanism stays for the keys later tasks declare;
- a removed v2 key (requirement "Removed v2 keys") answers `policy/unknown-config-key` with `why` naming its replacement or the reason it is gone;
- any other key answers `policy/unknown-config-key`, with a "did you mean" hint when a declared key is within edit distance 2;
- a value failing its module answers `policy/config-invalid`.

A module's key is a root key (`tools`) or a dotted subtree of a root (`policy.budgets`), so one root can hold the modules of several consumers; the registry composes the modules sharing a root into one strict object, and an unknown key under that root is still `policy/unknown-config-key`. Two modules declaring the same key, or one module's key being a prefix of another's (`policy` and `policy.gates`), fail the registry at startup. A structural test fails the build when a module names a slice that is not in `kernel-architecture`, Vertical slices, or when the consumer slice has a registered command handler and none of its use cases reads the module. A contract test fails the build when the key tables of this spec and the registry disagree: every registered key is in a table with the same type, default, owner and consumer, and every table key not registered is on the kernel's list of planned keys with the same owner.

#### Scenario: config layering with unknown key

- **WHEN** the global layer is valid and `.bdk/settings.yaml` sets `tools.tests` in a git repository fixture, and `bdk config check --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/unknown-config-key`, and `why` names `tools.tests`, the layer `project`, the file `.bdk/settings.yaml` and the hint `tools.test`

#### Scenario: key of a later task

- **WHEN** this spec declares a key for an owner task whose module is not registered yet, and `.bdk/settings.yaml` sets it
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and `lands with <owner>`

#### Scenario: key without a consumer

- **WHEN** a module names a consumer slice that has a registered handler but no use case of that slice reads the module
- **THEN** the S6 structural test fails the build

#### Scenario: spec and registry disagree

- **WHEN** a module changes a default without the matching row of this spec changing
- **THEN** the contract test fails naming the key

#### Scenario: one root, several consumers

- **WHEN** `graph` registers `policy.gates`, `attempt` registers `policy.budgets` and `shared/store` registers `policy.checkpoint`, and `.bdk/settings.yaml` sets `policy.budgets.verifier: 3` and `policy.gates.design: auto`
- **THEN** `bdk config check` exits 0, `bdk config show policy --json` shows both values with their origin, and `policy.budgets.verfier` answers `policy/unknown-config-key` with the hint `policy.budgets.verifier`

#### Scenario: planned key inside a registered subtree

- **WHEN** a test registry registers `policy.checkpoint` and plans `policy.checkpoint.later` for a later task, and a layer sets `policy.checkpoint.later: true`
- **THEN** the check answers `policy/unknown-config-key` with `why` naming that task

### Requirement: Keys of the project toolchain

The settings SHALL declare the project toolchain keys below, owned by T12.

| Key               | Type                              | Default | Owner | Consumer | v2 origin                           |
| ----------------- | --------------------------------- | ------- | ----- | -------- | ----------------------------------- |
| `languages`       | array of unique non-empty strings | `[]`    | T12   | `rules`  | `languages`                         |
| `tools.test`      | array of tool entries             | `[]`    | T12   | `ctx`    | `test-tools` (`type` becomes `id`)  |
| `tools.lint`      | array of tool entries             | `[]`    | T12   | `ctx`    | `lint-tools` (`type` becomes `id`)  |
| `tools.build`     | array of tool entries             | `[]`    | T12   | `ctx`    | `build-tools` (`type` becomes `id`) |
| `features.lavish` | boolean                           | `true`  | T12   | `ctx`    | `features.lavish`                   |

`languages` is free-form: a name gets rules only when the bundle ships a pack under `rules/languages/<name>/` (`rule-pack`, Pack layout); a project's own language rules are ordinary rule files with `applies`. The `rules` slice owns the rule text (`kernel-architecture`, Dependency matrix), and `ctx` reads it through `rules`. `features.lavish: false` makes skills fall back to `AskUserQuestion` (R-11).

#### Scenario: empty project

- **WHEN** no layer file exists and `bdk config show --json` runs
- **THEN** the exit code is 0 and the value holds every registered key with its default

### Requirement: Keys of rules and specs

The settings SHALL declare the rule and spec keys below. `rules.audit.min-changes` is the number of distinct Changes an item must appear in to be listed as recurring by `rules stats`; `rules.prune.uncited-changes` is how many recent Changes `rules prune` looks back for citations. The earlier drafts `rules.propose-when.changes`, `rules.propose-when.authors`, `rules.propose-when.failed-attempts` and `rules.max-learnings-per-change` are not keys: nothing is proposed at `close` (user decision 2026-09-30), so a layer setting one of them gets `policy/unknown-config-key` from the general rule.

| Key                           | Type                    | Default | Owner | Consumer | v2 origin |
| ----------------------------- | ----------------------- | ------- | ----- | -------- | --------- |
| `rules.max-per-package`       | integer >= 1            | `20`    | T31   | `rules`  | none      |
| `rules.disabled`              | array of unique strings | `[]`    | T31   | `rules`  | none      |
| `rules.audit.min-changes`     | integer >= 1            | `3`     | T31   | `rules`  | none      |
| `rules.prune.uncited-changes` | integer >= 1            | `20`    | T31   | `rules`  | none      |
| `spec.normative-word`         | non-empty string        | `SHALL` | T30   | `spec`   | none      |

#### Scenario: out-of-range value

- **WHEN** the `rules` module is registered and `.bdk/settings.yaml` sets `rules.max-per-package: 0`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `rules.max-per-package`

### Requirement: Removed v2 keys

The kernel SHALL refuse a key that v2 had and v3 dropped or renamed with `policy/unknown-config-key`, and `why` SHALL name the replacement or the reason.

| v2 key                       | Replacement or reason                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `test-tools`                 | `tools.test`                                                                                      |
| `lint-tools`                 | `tools.lint`                                                                                      |
| `build-tools`                | `tools.build`                                                                                     |
| `quality`                    | project rules in `.bdk/rules/` (`bdk rules import`), BDK rules switched off with `rules.disabled` |
| `language-rules`             | the bundle's language packs selected by `languages`, project rules with `applies`                 |
| `features.caveman`           | no consumer in v3 (#39)                                                                           |
| `features.serena`            | removed with the bundled MCP servers (ADR-0001)                                                   |
| `features.code-review-graph` | removed with the bundled MCP servers (ADR-0001)                                                   |
| `$schema`                    | the yaml-language-server modeline                                                                 |

#### Scenario: removed key named

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and ADR-0001

### Requirement: Prompt values

Markdown configuration values SHALL be files, one per prompt key, resolved across the same four layers, each layer contributing by `mode: extends` (appended to the value below) or `mode: replace` (discarding it).

A prompt key is the file path relative to a prompts directory without `.md` (`fragments/decision/lavish`), so it never contains a dot; its first segment is never `dir` or `files`. Each layer has one prompts directory, set only by `prompts.dir` in that layer's own file and never inherited; a relative `prompts.dir` resolves against the project root for the project and local layers and against the global layer's directory for the global layer. In the same layer, `prompts.files.<key>` wins over `<dir>/<key>.md`; its string form is a path with `mode: extends`, its object form carries `path`, `mode` and `applies`. A file's optional frontmatter carries `mode` and `applies` (a list of globs); for a file mapped by `prompts.files`, a frontmatter `mode` or `applies` that differs from the YAML entry answers `policy/config-invalid`. The default layer is the plugin file the prompt key declares, when it has one. Prompt keys are registered like YAML keys, as literal keys or as one-segment patterns: a prompts directory file or a `prompts.files` entry whose key is not registered answers `policy/unknown-config-key`. `applies` is validated as a list of globs and passed to the consumer, which interprets it. Rules are not prompt values (T31): the keys `rules/<category>` and `rules/languages/*` are not registered, and a prompts file or `prompts.files` entry for one answers `policy/unknown-config-key` whose `why` says that project rules live in `.bdk/rules/` and BDK rules are switched off with `rules.disabled`.

| Prompt key                                              | Default file (plugin)            | Owner | Consumer | v2 origin |
| ------------------------------------------------------- | -------------------------------- | ----- | -------- | --------- |
| `fragments/decision/lavish`                             | `fragments/decision/lavish.md`   | T13   | `ctx`    | none      |
| `fragments/decision/ask-user`                           | `fragments/decision/ask-user.md` | T13   | `ctx`    | none      |
| `pipeline/<kind>` (one literal key per registered kind) | `pipeline/<kind>.md`             | T21   | `graph`  | none      |

`pipeline/<kind>` is the instruction template of an artifact kind (`kernel-pipeline`, Instruction); a file for a name that is not a registered kind answers `policy/unknown-config-key`. Later tasks add prompt keys through a delta.

#### Scenario: extends then replace

- **WHEN** the plugin default of `fragments/decision/lavish` exists, the project layer has `.bdk/prompts/fragments/decision/lavish.md` with `mode: extends` and the local layer has `.bdk/prompts.local/fragments/decision/lavish.md` with `mode: replace`
- **THEN** the resolved value of `fragments/decision/lavish` is the local file alone, and `bdk config show prompts.fragments/decision/lavish --json` lists only the local file with mode `replace`

#### Scenario: file mapped from anywhere

- **WHEN** `.bdk/settings.yaml` sets `prompts.files.fragments/decision/lavish: docs/lavish.md` and that file has no frontmatter
- **THEN** the project contribution to `fragments/decision/lavish` is `docs/lavish.md` with `mode: extends`

#### Scenario: custom directory

- **WHEN** `.bdk/settings.yaml` sets `prompts.dir: docs/bdk-prompts` and `docs/bdk-prompts/fragments/decision/ask-user.md` exists
- **THEN** that file is the project contribution to `fragments/decision/ask-user` and `.bdk/prompts/` is not read

#### Scenario: unknown prompt file

- **WHEN** `.bdk/prompts/fragments/decision/lavsh.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `fragments/decision/lavsh` and the project layer

#### Scenario: rule prompt file refused

- **WHEN** `.bdk/prompts/rules/security.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key`, and `why` names the file, `.bdk/rules/` and `rules.disabled`

#### Scenario: dropped funnel key

- **WHEN** `.bdk/settings.yaml` sets `rules.propose-when.authors: 1`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming the key

#### Scenario: project replaces a fragment

- **WHEN** `.bdk/prompts/fragments/decision/ask-user.md` has `mode: replace`
- **THEN** the resolved value of `fragments/decision/ask-user` is that file alone, and `bdk config show prompts.fragments/decision/ask-user --json` lists only that file

#### Scenario: template for an unknown kind

- **WHEN** `.bdk/prompts/pipeline/desing.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `pipeline/desing`
