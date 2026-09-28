## MODIFIED Requirements

### Requirement: Registry and consumers

Every key the kernel accepts SHALL be declared by exactly one registered config module, and every module SHALL name the slice that consumes it (S6: no unknown key, no key without a consumer).

A module declares its key, its zod schema with defaults, a description and its consumer slice, and lives in the consumer slice's `config.ts` (`kernel-architecture`, Slice anatomy); `shared/config` and `shared/store` declare the modules they consume themselves, in `shared/config/modules.ts` and `shared/<module>/config.ts`. The consumer column of the tables below names that slice; another slice that needs the value reads it through the consumer's `index.ts`, within the dependency matrix. A module is registered by the task that lands its consumer, so the registry holds a subset of the keys this spec declares. Validation is strict and reports every error with the full dotted key, the layer and the file:

- a key this spec declares whose owner task has not registered it answers `policy/unknown-config-key` with `why` naming the owner task (`lands with T23`);
- a removed v2 key (requirement "Removed v2 keys") answers `policy/unknown-config-key` with `why` naming its replacement or the reason it is gone;
- any other key answers `policy/unknown-config-key`, with a "did you mean" hint when a declared key is within edit distance 2;
- a value failing its module answers `policy/config-invalid`.

A module's key is a root key (`tools`) or a dotted subtree of a root (`policy.budgets`), so one root can hold the modules of several consumers; the registry composes the modules sharing a root into one strict object, and an unknown key under that root is still `policy/unknown-config-key`. Two modules declaring the same key, or one module's key being a prefix of another's (`policy` and `policy.gates`), fail the registry at startup. A structural test fails the build when a module names a slice that is not in `kernel-architecture`, Vertical slices, or when the consumer slice has a registered command handler and none of its use cases reads the module. A contract test fails the build when the key tables of this spec and the registry disagree: every registered key is in a table with the same type, default, owner and consumer, and every table key not registered is on the kernel's list of planned keys with the same owner.

#### Scenario: config layering with unknown key

- **WHEN** the global layer is valid and `.bdk/settings.yaml` sets `tools.tests` in a git repository fixture, and `bdk config check --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/unknown-config-key`, and `why` names `tools.tests`, the layer `project`, the file `.bdk/settings.yaml` and the hint `tools.test`

#### Scenario: key of a later task

- **WHEN** `.bdk/settings.yaml` sets `archive.keep-evidence` before T23 part C registers its module
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and `lands with T23`

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

- **WHEN** `policy.checkpoint` is registered and `.bdk/settings.yaml` sets `policy.checkpoint.squash-at-close: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming `lands with T30`

### Requirement: Keys of the project toolchain

The settings SHALL declare the project toolchain keys below, owned by T12.

| Key               | Type                              | Default | Owner | Consumer | v2 origin                           |
| ----------------- | --------------------------------- | ------- | ----- | -------- | ----------------------------------- |
| `languages`       | array of unique non-empty strings | `[]`    | T12   | `rules`  | `languages`                         |
| `tools.test`      | array of tool entries             | `[]`    | T12   | `ctx`    | `test-tools` (`type` becomes `id`)  |
| `tools.lint`      | array of tool entries             | `[]`    | T12   | `ctx`    | `lint-tools` (`type` becomes `id`)  |
| `tools.build`     | array of tool entries             | `[]`    | T12   | `ctx`    | `build-tools` (`type` becomes `id`) |
| `features.lavish` | boolean                           | `true`  | T12   | `ctx`    | `features.lavish`                   |

`languages` is free-form: a name gets content only when a `rules/languages/<name>` prompt value exists. The `rules` slice owns the rule text (`kernel-architecture`, Dependency matrix), and `ctx` reads it through `rules`. `features.lavish: false` makes skills fall back to `AskUserQuestion` (R-11).

#### Scenario: empty project

- **WHEN** no layer file exists and `bdk config show --json` runs
- **THEN** the exit code is 0 and the value holds every registered key with its default

### Requirement: Keys of workflow policy

The settings SHALL declare the workflow policy keys below. Each is registered by its owner task with its consumer.

| Key                                   | Type                      | Default                                                                                                           | Owner | Consumer       | v2 origin |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- | -------------- | --------- |
| `policy.gates.design`                 | `manual` or `auto`        | `manual`                                                                                                          | T21   | `graph`        | none      |
| `policy.gates.review`                 | `manual` or `auto`        | `manual`                                                                                                          | T21   | `graph`        | none      |
| `policy.budgets.task-redispatch`      | integer >= 0              | `3`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.verify-fix`           | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.review-fix`           | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.verifier`             | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.not-run`              | integer >= 0              | `3`                                                                                                               | T22   | `attempt`      | none      |
| `policy.oscillation.threshold`        | integer >= 1              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.escalation.enabled`           | boolean                   | `true`                                                                                                            | T22   | `attempt`      | none      |
| `policy.escalation.model`             | non-empty string          | `opus`                                                                                                            | T22   | `attempt`      | none      |
| `policy.escalation.per-change`        | integer >= 0              | `3`                                                                                                               | T22   | `attempt`      | none      |
| `policy.checkpoint.enabled`           | boolean                   | `true`                                                                                                            | T22   | `shared/store` | none      |
| `policy.checkpoint.squash-at-close`   | boolean                   | `false`                                                                                                           | T30   | `shared/store` | none      |
| `policy.verifier.blocking-categories` | array of category entries | `architecture`, `security`, `irreversible-step`, `integration-failure`, `unresolved-decision`, `false-code-claim` | T23   | `log`          | none      |
| `policy.verifier.not-a-fail`          | array of category entries | `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length`, `verification-defect`           | T23   | `log`          | none      |

`policy.gates.<gate>` holds one key per human gate the graph defines; T21 may add a gate through a delta. A project extends the blocking categories by adding items and disables one by replacing the array in a higher layer. `policy.escalation.model` names a model class, not a model id; the dispatch adapter maps it (P11). `policy.escalation.per-change` caps the escalation tickets of one Change, because the kernel sees no token cost (`kernel-loops`, Escalation ladder). `policy.checkpoint.squash-at-close` is read only by `change close --squash` (T30) and defaults to keeping checkpoints as history. Each subtree is one config module: `policy.gates` (`graph`), `policy.budgets`, `policy.oscillation` and `policy.escalation` (`attempt`), `policy.checkpoint` (`shared/store`, the checkpoint core every caller shares), `policy.verifier` (`log`, which downgrades an uncategorised verifier blocker; `dispatch` reads both lists through `log` to put them in a verifier's package). The default descriptions restate the design's Verifier contracts (P8): `verification-defect` reads "a verification defect, unless it removes the only real evidence of the change's safety". `policy.log.max-observations` is gone with the per-dispatch observation cap (T23-D13).

#### Scenario: extend the blocking categories

- **WHEN** the `policy` module is registered and `.bdk/settings.yaml` adds a `policy.verifier.blocking-categories` item with `id: accessibility`
- **THEN** the resolved list holds the six default categories followed by `accessibility`

#### Scenario: T22 defaults

- **WHEN** no layer sets a `policy` key and `bdk config show policy --json` runs
- **THEN** the budgets are `task-redispatch: 3`, `verify-fix: 2`, `review-fix: 2`, `verifier: 2`, `not-run: 3`, `oscillation.threshold` is 2, `escalation` is `{enabled: true, model: opus, per-change: 3}` and `checkpoint.enabled` is true

#### Scenario: not-a-fail defaults

- **WHEN** no layer sets `policy.verifier` and `bdk config show policy.verifier --json` runs
- **THEN** `blocking-categories` holds the six P8 categories and `not-a-fail` holds `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length` and `verification-defect`

### Requirement: Prompt values

Markdown configuration values SHALL be files, one per prompt key, resolved across the same four layers, each layer contributing by `mode: extends` (appended to the value below) or `mode: replace` (discarding it).

A prompt key is the file path relative to a prompts directory without `.md` (`rules/security`), so it never contains a dot; its first segment is never `dir` or `files`. Each layer has one prompts directory, set only by `prompts.dir` in that layer's own file and never inherited; a relative `prompts.dir` resolves against the project root for the project and local layers and against the global layer's directory for the global layer. In the same layer, `prompts.files.<key>` wins over `<dir>/<key>.md`; its string form is a path with `mode: extends`, its object form carries `path`, `mode` and `applies`. A file's optional frontmatter carries `mode` and `applies` (a list of globs); for a file mapped by `prompts.files`, a frontmatter `mode` or `applies` that differs from the YAML entry answers `policy/config-invalid`. The default layer is the plugin file the prompt key declares, when it has one. Prompt keys are registered like YAML keys, as literal keys or as one-segment patterns: a prompts directory file or a `prompts.files` entry whose key is not registered answers `policy/unknown-config-key`. `applies` is validated as a list of globs and passed to the consumer, which interprets it; `rules` resolves the rule sets for `ctx` and for `rules show --ticket` and ignores `applies` until T31.

| Prompt key                                              | Default file (plugin)                    | Owner | Consumer | v2 origin                 |
| ------------------------------------------------------- | ---------------------------------------- | ----- | -------- | ------------------------- |
| `rules/code-quality`                                    | `rules/code-quality.md`                  | T12   | `rules`  | `quality.code-quality`    |
| `rules/architecture`                                    | `rules/architecture.md`                  | T12   | `rules`  | `quality.architecture`    |
| `rules/design-patterns`                                 | `rules/design-patterns.md`               | T12   | `rules`  | `quality.design-patterns` |
| `rules/security`                                        | `rules/security.md`                      | T12   | `rules`  | `quality.security`        |
| `rules/engineering-judgment`                            | `rules/engineering-judgment.md`          | T12   | `rules`  | none                      |
| `rules/test-quality`                                    | `rules/test-quality.md`                  | T12   | `rules`  | none                      |
| `rules/languages/*`                                     | `rules/languages/<name>.md` when shipped | T12   | `rules`  | `language-rules.<name>`   |
| `fragments/decision/lavish`                             | `fragments/decision/lavish.md`           | T13   | `ctx`    | none                      |
| `fragments/decision/ask-user`                           | `fragments/decision/ask-user.md`         | T13   | `ctx`    | none                      |
| `pipeline/<kind>` (one literal key per registered kind) | `pipeline/<kind>.md`                     | T21   | `graph`  | none                      |

`pipeline/<kind>` is the instruction template of an artifact kind (`kernel-pipeline`, Instruction); a file for a name that is not a registered kind answers `policy/unknown-config-key`. Later tasks add prompt keys through a delta.

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

#### Scenario: template for an unknown kind

- **WHEN** `.bdk/prompts/pipeline/desing.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `pipeline/desing`
