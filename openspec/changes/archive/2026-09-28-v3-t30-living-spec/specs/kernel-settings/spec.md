## MODIFIED Requirements

### Requirement: Registry and consumers

Every key the kernel accepts SHALL be declared by exactly one registered config module, and every module SHALL name the slice that consumes it (S6: no unknown key, no key without a consumer).

A module declares its key, its zod schema with defaults, a description and its consumer slice, and lives in the consumer slice's `config.ts` (`kernel-architecture`, Slice anatomy); `shared/config` and `shared/store` declare the modules they consume themselves, in `shared/config/modules.ts` and `shared/<module>/config.ts`. The consumer column of the tables below names that slice; another slice that needs the value reads it through the consumer's `index.ts`, within the dependency matrix. A module is registered by the task that lands its consumer, so the registry holds a subset of the keys this spec declares. Validation is strict and reports every error with the full dotted key, the layer and the file:

- a key this spec declares whose owner task has not registered it answers `policy/unknown-config-key` with `why` naming the owner task (`lands with T31`);
- a removed v2 key (requirement "Removed v2 keys") answers `policy/unknown-config-key` with `why` naming its replacement or the reason it is gone;
- any other key answers `policy/unknown-config-key`, with a "did you mean" hint when a declared key is within edit distance 2;
- a value failing its module answers `policy/config-invalid`.

A module's key is a root key (`tools`) or a dotted subtree of a root (`policy.budgets`), so one root can hold the modules of several consumers; the registry composes the modules sharing a root into one strict object, and an unknown key under that root is still `policy/unknown-config-key`. Two modules declaring the same key, or one module's key being a prefix of another's (`policy` and `policy.gates`), fail the registry at startup. A structural test fails the build when a module names a slice that is not in `kernel-architecture`, Vertical slices, or when the consumer slice has a registered command handler and none of its use cases reads the module. A contract test fails the build when the key tables of this spec and the registry disagree: every registered key is in a table with the same type, default, owner and consumer, and every table key not registered is on the kernel's list of planned keys with the same owner.

#### Scenario: config layering with unknown key

- **WHEN** the global layer is valid and `.bdk/settings.yaml` sets `tools.tests` in a git repository fixture, and `bdk config check --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/unknown-config-key`, and `why` names `tools.tests`, the layer `project`, the file `.bdk/settings.yaml` and the hint `tools.test`

#### Scenario: key of a later task

- **WHEN** `.bdk/settings.yaml` sets `rules.max-per-package` before T31 registers its module
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and `lands with T31`

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
| `policy.verifier.blocking-categories` | array of category entries | `architecture`, `security`, `irreversible-step`, `integration-failure`, `unresolved-decision`, `false-code-claim` | T23   | `log`          | none      |
| `policy.verifier.not-a-fail`          | array of category entries | `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length`, `verification-defect`           | T23   | `log`          | none      |

`policy.gates.<gate>` holds one key per human gate the graph defines; T21 may add a gate through a delta. A project extends the blocking categories by adding items and rewords one by setting an item with the same `id`; the default items always stay, so a default category cannot be removed in 3.0. `policy.escalation.model` names a model class, not a model id; the dispatch adapter maps it (P11). `policy.escalation.per-change` caps the escalation tickets of one Change, because the kernel sees no token cost (`kernel-loops`, Escalation ladder). Checkpoint commits stay as history: contract version 3 has no squash at close (T30, user decision 2026-09-28), a squash merge of the PR folds them. Each subtree is one config module: `policy.gates` (`graph`), `policy.budgets`, `policy.oscillation` and `policy.escalation` (`attempt`), `policy.checkpoint` (`shared/store`, the checkpoint core every caller shares), `policy.verifier` (`log`, which downgrades an uncategorised verifier blocker; `dispatch` reads both lists through `log` to put them in a verifier's package). The default descriptions restate the design's Verifier contracts (P8): `verification-defect` reads "a verification defect, unless it removes the only real evidence of the change's safety". `policy.log.max-observations` is gone with the per-dispatch observation cap (T23-D13).

#### Scenario: extend the blocking categories

- **WHEN** the `policy` module is registered and `.bdk/settings.yaml` adds a `policy.verifier.blocking-categories` item with `id: accessibility`
- **THEN** the resolved list holds the six default categories followed by `accessibility`

#### Scenario: T22 defaults

- **WHEN** no layer sets a `policy` key and `bdk config show policy --json` runs
- **THEN** the budgets are `task-redispatch: 3`, `verify-fix: 2`, `review-fix: 2`, `verifier: 2`, `not-run: 3`, `oscillation.threshold` is 2, `escalation` is `{enabled: true, model: opus, per-change: 3}` and `checkpoint.enabled` is true

#### Scenario: not-a-fail defaults

- **WHEN** no layer sets `policy.verifier` and `bdk config show policy.verifier --json` runs
- **THEN** `blocking-categories` holds the six P8 categories and `not-a-fail` holds `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length` and `verification-defect`

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                     | Type            | Default | Owner | Consumer | v2 origin |
| ----------------------- | --------------- | ------- | ----- | -------- | --------- |
| `execution.concurrency` | integer 1 to 15 | `5`     | T23   | `ctx`    | none      |
| `archive.keep-evidence` | boolean         | `false` | T30   | `change` | none      |

`execution.concurrency` caps how many dispatches of one wave the orchestrator runs at once through the host's own subagents; the kernel runs no dispatch process itself, so there is no runner or host key. `ctx` consumes it: the swarm skill's context (`bdk ctx skill swarm`) carries a `Concurrency` section stating the resolved value (T23-D52). `archive.keep-evidence: true` keeps the full `dispatch/` and `reports/` bodies in the archived Change; by default `change close` replaces them with their hash index (`kernel-state`, Pruned index; T23-D53). T30 registers its module with its consumer, `change close`.

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
