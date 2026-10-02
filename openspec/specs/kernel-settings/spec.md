# kernel-settings Specification

## Purpose

The settings of BDK v3: the four layer files, how they merge, how keys are named and addressed, the Markdown prompt values, the resolved snapshot, the JSON Schema and its modeline, and the full tree of v3 keys with the type, default, owner task, consumer slice and v2 origin of each. The `config` commands that read and write these files are in `kernel-cli/config`; where the modules live in code is in `kernel-architecture`. A key's owner task registers its module when its consumer lands and may amend its row through a delta; until then the key is declared here and refused by the kernel with the owner's name.

## Requirements

### Requirement: Configuration layers

The kernel SHALL resolve the configuration from four layers, higher wins: bundle defaults < global < project (`.bdk/settings.yaml`) < local (`.bdk/settings.local.yaml`), named `default`, `global`, `project` and `local` in every output.

The global layer file is `$XDG_CONFIG_HOME/bdk/settings.yaml` when `XDG_CONFIG_HOME` is set and absolute, `%APPDATA%\bdk\settings.yaml` on Windows, and `~/.config/bdk/settings.yaml` otherwise. The project root is the directory `findProjectRoot` resolves (the nearest directory holding `.bdk/` up to the work tree root). An absent file is skipped; an empty file is an empty layer. A file that is not valid YAML, or whose top level is not a mapping, answers `policy/config-invalid` naming the file and, for a syntax error, the line. The default layer is the defaults of the registered modules, compiled into the bundle. `.bdk/settings.json` (v2) is never read; `/bdk:setup` migrates it.

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

The kernel SHALL merge the layers key by key: mappings deep-merge, arrays whose items are mappings with an `id` merge item by item on `id`, an array its module declares append-only merges by appending, every other array and every scalar is replaced whole by the higher layer.

An item of an `id` array that a higher layer adds is appended in that layer's order; an item it names by an existing `id` is deep-merged into the lower item. Two items with the same `id` in one layer answer `policy/config-invalid`. `null` is a value like any other: it fails a key that is not nullable and never deletes a lower layer's key. An append-only array (the glob lists of `policy.evidence`, user choice T23-D48) starts from its default; each layer appends the items the lower layers and the default do not hold, in its own order, so a project extends the list and never removes a default item. A higher layer may set any other declared key, including one that disables a policy (full override, D4).

#### Scenario: array merged by id

- **WHEN** the project layer declares `tools.test` items `unit` and `e2e`, and the local layer declares `tools.test` item `unit` with only `scoped`
- **THEN** the resolved `tools.test` holds `unit` with the project fields plus the local `scoped`, followed by `e2e` unchanged

#### Scenario: scalar array replaced

- **WHEN** the project layer sets `languages: [typescript, react]` and the local layer sets `languages: [typescript]`
- **THEN** the resolved `languages` is `[typescript]`

#### Scenario: append-only array

- **WHEN** the project layer sets `policy.evidence.non-executable: ["site/**", "**/*.md"]`
- **THEN** the resolved list holds every default glob followed by `site/**` once, and `**/*.md` stays in its default place

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
| `languages`       | array of unique non-empty strings | `[]`    | T12   | `rules`  | `languages`                         |
| `tools.test`      | array of tool entries             | `[]`    | T12   | `ctx`    | `test-tools` (`type` becomes `id`)  |
| `tools.lint`      | array of tool entries             | `[]`    | T12   | `ctx`    | `lint-tools` (`type` becomes `id`)  |
| `tools.build`     | array of tool entries             | `[]`    | T12   | `ctx`    | `build-tools` (`type` becomes `id`) |
| `features.lavish` | boolean                           | `true`  | T12   | `ctx`    | `features.lavish`                   |

`languages` is free-form: a name gets rules only when the bundle ships a pack under `rules/languages/<name>/` (`rule-pack`, Pack layout); a project's own language rules are ordinary rule files with `applies`. The `rules` slice owns the rule text (`kernel-architecture`, Dependency matrix), and `ctx` reads it through `rules`. `features.lavish: false` makes skills fall back to `AskUserQuestion` (R-11).

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

| Key                                   | Type                      | Default                                                                                                           | Owner | Consumer       | v2 origin |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- | -------------- | --------- |
| `policy.gates.design`                 | `manual` or `auto`        | `manual`                                                                                                          | T21   | `graph`        | none      |
| `policy.gates.review`                 | `manual` or `auto`        | `manual`                                                                                                          | T21   | `graph`        | none      |
| `policy.budgets.task-redispatch`      | integer >= 0              | `3`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.verify-fix`           | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.review-fix`           | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.verifier`             | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.part-lead`            | integer >= 0              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.budgets.not-run`              | integer >= 0              | `3`                                                                                                               | T22   | `attempt`      | none      |
| `policy.oscillation.threshold`        | integer >= 1              | `2`                                                                                                               | T22   | `attempt`      | none      |
| `policy.escalation.enabled`           | boolean                   | `true`                                                                                                            | T22   | `attempt`      | none      |
| `policy.escalation.model`             | non-empty string          | `opus`                                                                                                            | T22   | `attempt`      | none      |
| `policy.escalation.per-change`        | integer >= 0              | `3`                                                                                                               | T22   | `attempt`      | none      |
| `policy.checkpoint.enabled`           | boolean                   | `true`                                                                                                            | T22   | `shared/store` | none      |
| `policy.verifier.blocking-categories` | array of category entries | `architecture`, `security`, `irreversible-step`, `integration-failure`, `unresolved-decision`, `false-code-claim` | T23   | `log`          | none      |
| `policy.verifier.not-a-fail`          | array of category entries | `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length`, `verification-defect`           | T23   | `log`          | none      |

`policy.gates.<gate>` holds one key per human gate the graph defines; T21 may add a gate through a delta. A project extends the blocking categories by adding items and rewords one by setting an item with the same `id`; the default items always stay, so a default category cannot be removed in 3.0. `policy.escalation.model` names a model class, not a model id; the dispatch adapter maps it (P11). `policy.escalation.per-change` caps the escalation tickets of one Change, because the kernel sees no token cost (`kernel-loops`, Escalation ladder). Checkpoint commits stay as history: contract version 3 has no squash at close (T30, user decision 2026-09-28), a squash merge of the PR folds them. Each subtree is one config module: `policy.gates` (`graph`), `policy.budgets`, `policy.oscillation` and `policy.escalation` (`attempt`), `policy.checkpoint` (`shared/store`, the checkpoint core every caller shares), `policy.verifier` (`log`, which downgrades an uncategorised verifier blocker; `dispatch` reads both lists through `log` to put them in a verifier's package). The default descriptions restate the design's Verifier contracts (P8): `verification-defect` reads "a verification defect, unless it removes the only real evidence of the change's safety". `policy.log.max-observations` is gone with the per-dispatch observation cap (T23-D13).

#### Scenario: extend the blocking categories

- **WHEN** the `policy` module is registered and `.bdk/settings.yaml` adds a `policy.verifier.blocking-categories` item with `id: accessibility`
- **THEN** the resolved list holds the six default categories followed by `accessibility`

#### Scenario: T22 defaults

- **WHEN** no layer sets a `policy` key and `bdk config show policy --json` runs
- **THEN** the budgets are `task-redispatch: 3`, `verify-fix: 2`, `review-fix: 2`, `verifier: 2`, `part-lead: 2`, `not-run: 3`, `oscillation.threshold` is 2, `escalation` is `{enabled: true, model: opus, per-change: 3}` and `checkpoint.enabled` is true

#### Scenario: not-a-fail defaults

- **WHEN** no layer sets `policy.verifier` and `bdk config show policy.verifier --json` runs
- **THEN** `blocking-categories` holds the six P8 categories and `not-a-fail` holds `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length` and `verification-defect`

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                        | Type            | Default | Owner | Consumer | v2 origin |
| -------------------------- | --------------- | ------- | ----- | -------- | --------- |
| `execution.concurrency`    | integer 1 to 15 | `5`     | T23   | `ctx`    | none      |
| `execution.tree.enabled`   | boolean         | `true`  | T41   | `graph`  | none      |
| `execution.tree.min-parts` | integer 2 to 15 | `2`     | T41   | `graph`  | none      |
| `archive.keep-evidence`    | boolean         | `false` | T30   | `change` | none      |

`execution.concurrency` caps how many dispatches of one wave the orchestrator runs at once through the host's own subagents; the kernel runs no dispatch process itself, so there is no runner or host key. `ctx` consumes it: the swarm skill's context (`bdk ctx skill swarm`) carries a `Concurrency` section stating the resolved value (T23-D52). `execution.tree` is its own module, consumed by `graph`: `bdk next` marks a part of the execute wave that is not started `tree` (one lead per part) only on a `large` Change, with `enabled` true and at least `min-parts` such parts in the wave, and `flat` otherwise (`kernel-cli/graph`, bdk next; T41-D3). No `features.workflow` key exists: a layer setting it gets `policy/unknown-config-key` (user decision 2026-10-01, Change `v3-t41-execute`). `archive.keep-evidence: true` keeps the full `dispatch/` and `reports/` bodies in the archived Change; by default `change close` replaces them with their hash index (`kernel-state`, Pruned index; T23-D53). T30 registers its module with its consumer, `change close`.

#### Scenario: concurrency default

- **WHEN** the `execution` module is registered, no layer sets `execution.concurrency` and `bdk config show execution.concurrency --json` runs
- **THEN** the exit code is 0 and the value is `5`

#### Scenario: detected key unset

- **WHEN** the `execution` module is registered and `bdk config show execution.runner` runs
- **THEN** the exit code is 2 with `rule: policy/unknown-config-key`, because the module declares no runner or host key

#### Scenario: removed runner key in a layer

- **WHEN** `.bdk/settings.yaml` sets `execution.runner: headless`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `execution.runner`

#### Scenario: concurrency in the swarm context

- **WHEN** `.bdk/settings.yaml` sets `execution.concurrency: 3` and `bdk ctx skill swarm` runs
- **THEN** its `Concurrency` section states 3

#### Scenario: concurrency out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.concurrency: 16`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.concurrency`

#### Scenario: keep evidence registered

- **WHEN** no layer sets `archive.keep-evidence` and `bdk config show archive.keep-evidence --json` runs
- **THEN** the exit code is 0 and the value is `false`

#### Scenario: tree defaults

- **WHEN** no layer sets `execution.tree` and `bdk config show execution.tree --json` runs
- **THEN** the value is `{enabled: true, min-parts: 2}`

#### Scenario: tree threshold out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.tree.min-parts: 1`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.tree.min-parts`

#### Scenario: no workflow switch

- **WHEN** `.bdk/settings.yaml` sets `features.workflow: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `features.workflow`

### Requirement: Keys of rules and specs

The settings SHALL declare the rule and spec keys below. `rules.audit.min-changes` is the number of distinct Changes an item must appear in to be listed as recurring by `rules stats`; `rules.prune.uncited-changes` is how many recent Changes `rules prune` looks back for citations. `rules.warn-above` is the number of rules one role may read before `hooks session-start` warns; it is no cap, since every applying rule reaches the agent. The earlier drafts `rules.propose-when.changes`, `rules.propose-when.authors`, `rules.propose-when.failed-attempts` and `rules.max-learnings-per-change` are not keys: nothing is proposed at `close` (user decision 2026-09-30), so a layer setting one of them gets `policy/unknown-config-key` from the general rule.

| Key                           | Type                    | Default | Owner | Consumer | v2 origin |
| ----------------------------- | ----------------------- | ------- | ----- | -------- | --------- |
| `rules.warn-above`            | integer >= 1            | `100`   | T31   | `rules`  | none      |
| `rules.disabled`              | array of unique strings | `[]`    | T31   | `rules`  | none      |
| `rules.audit.min-changes`     | integer >= 1            | `3`     | T31   | `rules`  | none      |
| `rules.prune.uncited-changes` | integer >= 1            | `20`    | T31   | `rules`  | none      |
| `spec.normative-word`         | non-empty string        | `SHALL` | T30   | `spec`   | none      |

#### Scenario: out-of-range value

- **WHEN** the `rules` module is registered and `.bdk/settings.yaml` sets `rules.warn-above: 0`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `rules.warn-above`

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

### Requirement: Keys of evidence policy

The settings SHALL declare the evidence policy keys below, registered as one module `policy.evidence` with consumer `evidence` (T23-D16, D46, D48).

| Key                                   | Type                                        | Default                                                                                                                                                                                                                                                                                    | Owner | Consumer   | v2 origin |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | --------- |
| `policy.evidence.non-executable`      | append-only array of unique non-empty globs | `**/*.md`, `**/*.mdx`, `**/*.txt`, `**/*.rst`, `**/*.png`, `**/*.jpg`, `**/*.jpeg`, `**/*.gif`, `**/*.svg`, `**/*.webp`, `docs/**`, `LICENSE*`, `CHANGELOG*`, `.bdk/**`                                                                                                                    | T23   | `evidence` | none      |
| `policy.evidence.build-config`        | append-only array of unique non-empty globs | `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, `poetry.lock`, `requirements*.txt`, `go.mod`, `go.sum`, `Cargo.toml`, `Cargo.lock`, `Gemfile`, `Gemfile.lock`, `pom.xml`, `build.gradle*`, `Makefile`, `CMakeLists.txt` | T23   | `evidence` | none      |
| `policy.evidence.max-committed-bytes` | integer >= 0                                | `65536`                                                                                                                                                                                                                                                                                    | T23   | `evidence` | none      |

Globs match paths relative to the project root; `*` stays within one path segment and `**` crosses segments. A path matching `build-config` counts as build config even when it also matches `non-executable` (`requirements.txt`). The two lists are the kernel's copy of the file-class partition of `.claude/rules/verification-scoping.md`: non-executable content never changes the tree hash, build-feeding config always does (`kernel-state`, Evidence manifest, Tree hash). `max-committed-bytes: 0` keeps every evidence file on the machine. A project whose Markdown is executable content (a documentation build) makes it count by listing it in `build-config`, since a default item cannot be removed.

#### Scenario: evidence defaults

- **WHEN** no layer sets `policy.evidence` and `bdk config show policy.evidence --json` runs
- **THEN** the exit code is 0, the two lists hold the defaults of the table and `max-committed-bytes` is 65536

#### Scenario: project appends a glob

- **WHEN** `.bdk/settings.yaml` sets `policy.evidence.build-config: ["mkdocs.yml", "docs/**"]`
- **THEN** the resolved `build-config` holds the defaults followed by both globs, and a change under `docs/` changes the tree hash

### Requirement: Keys of agent orchestration

The settings SHALL declare the agent orchestration keys below, registered below the root `agents` as one module per key, each with the slice that reads it (T41-D4, D5, D6, D7).

| Key                           | Type               | Default | Owner | Consumer | v2 origin |
| ----------------------------- | ------------------ | ------- | ----- | -------- | --------- |
| `agents.ttl`                  | integer 60 to 1800 | `300`   | T41   | `agents` | none      |
| `agents.open-call-limit`      | integer 60 to 3600 | `720`   | T41   | `agents` | none      |
| `agents.message.max-chars`    | integer 50 to 2000 | `300`   | T41   | `hooks`  | none      |
| `agents.continuation.max`     | integer 0 to 10    | `3`     | T41   | `hooks`  | none      |
| `agents.scout.max-per-ticket` | integer 0 to 10    | `2`     | T41   | `hooks`  | none      |

`agents.ttl` is the seconds without a tool call after which an agent with no open call is `suspect`; `agents.open-call-limit` is the seconds after which an open tool call no longer keeps an agent `running` (`kernel-state`, Agent registry). The open-call default stays above the host's 10-minute `Bash` limit, so a long test run never makes its agent `suspect`. `agents.message.max-chars` bounds a message between agents (`kernel-cli/hooks`, Pre-tool guards). `agents.continuation.max` is how many turn ends in a row the continuation check blocks without progress; `0` switches the check off (`kernel-cli/hooks`, bdk hooks stop, bdk hooks subagent-stop). `agents.scout.max-per-ticket` is how many `scout` agents a worker may start under one ticket; `0` forbids it.

#### Scenario: agents defaults

- **WHEN** no layer sets an `agents` key and `bdk config show agents --json` runs
- **THEN** the exit code is 0 and the values are `ttl: 300`, `open-call-limit: 720`, `message.max-chars: 300`, `continuation.max: 3` and `scout.max-per-ticket: 2`

#### Scenario: ttl out of range

- **WHEN** `.bdk/settings.yaml` sets `agents.ttl: 10`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `agents.ttl`
