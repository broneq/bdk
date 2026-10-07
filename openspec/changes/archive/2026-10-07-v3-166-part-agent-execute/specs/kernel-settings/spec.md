## MODIFIED Requirements

### Requirement: Key naming and addressing

Every key segment SHALL be kebab-case: lowercase letters, digits and `-`, starting with a letter or digit (`^[a-z0-9][a-z0-9-]*$`), and so SHALL every `id` of an item in an array merged by `id`.

A key is written as a dotted path (`policy.budgets.review-fix`). An item of an array merged by `id` is addressed by its `id` as a path segment (`tools.test.unit.scoped`) in every place a dotted key appears: `config show`, `config set`, `why`, `origins`, `overriddenKeys`. A prompt key (requirement "Prompt values") is addressed as `prompts.<prompt key>` (`prompts.rules/security`). An enum value follows the same casing (`host-agent`).

#### Scenario: camelCase key

- **WHEN** `.bdk/settings.yaml` sets `policy.budgets.reviewFix`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and the hint `policy.budgets.review-fix`

#### Scenario: id that is not a path segment

- **WHEN** a `tools.test` item has `id: unit.fast`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `tools.test` and the id

### Requirement: Keys of workflow policy

The settings SHALL declare the workflow policy keys below. Each is registered by its owner task with its consumer.

| Key                                   | Type                      | Default                                                                                                                             | Owner | Consumer       | v2 origin |
| ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------- | --------- |
| `policy.gates.design`                 | `manual` or `auto`        | `manual`                                                                                                                            | T21   | `graph`        | none      |
| `policy.gates.review`                 | `manual` or `auto`        | `manual`                                                                                                                            | T21   | `graph`        | none      |
| `policy.budgets.part`                 | integer >= 0              | `3`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.budgets.verify-fix`           | integer >= 0              | `2`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.budgets.review-fix`           | integer >= 0              | `2`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.budgets.verifier`             | integer >= 0              | `2`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.budgets.not-run`              | integer >= 0              | `3`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.oscillation.threshold`        | integer >= 1              | `2`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.escalation.enabled`           | boolean                   | `true`                                                                                                                              | T22   | `attempt`      | none      |
| `policy.escalation.model`             | non-empty string          | `opus`                                                                                                                              | T22   | `attempt`      | none      |
| `policy.escalation.per-change`        | integer >= 0              | `3`                                                                                                                                 | T22   | `attempt`      | none      |
| `policy.checkpoint.enabled`           | boolean                   | `true`                                                                                                                              | T22   | `shared/store` | none      |
| `policy.verifier.blocking-categories` | array of category entries | `architecture`, `security`, `irreversible-step`, `integration-failure`, `unresolved-decision`, `false-code-claim`, `costly-command` | T23   | `log`          | none      |
| `policy.verifier.not-a-fail`          | array of category entries | `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length`, `verification-defect`                             | T23   | `log`          | none      |

`policy.gates.<gate>` holds one key per human gate the graph defines; T21 may add a gate through a delta. A project extends the blocking categories by adding items and rewords one by setting an item with the same `id`; the default items always stay, so a default category cannot be removed in 3.0. `policy.escalation.model` names a model class, not a model id; the dispatch adapter maps it (P11). `policy.escalation.per-change` caps the escalation tickets of one Change, because the kernel sees no token cost (`kernel-loops`, Escalation ladder). Checkpoint commits stay as history: contract version 3 has no squash at close (T30, user decision 2026-09-28), a squash merge of the PR folds them. Each subtree is one config module: `policy.gates` (`graph`), `policy.budgets`, `policy.oscillation` and `policy.escalation` (`attempt`), `policy.checkpoint` (`shared/store`, the checkpoint core every caller shares), `policy.verifier` (`log`, which downgrades an uncategorised verifier blocker; `dispatch` reads both lists through `log` to put them in a verifier's package). `costly-command` (#166) reads "a plan acceptance or task that can run a command that spends money, needs credentials or reaches a shared or external system, or names its commands by exclusion". The default descriptions restate the design's Verifier contracts (P8): `verification-defect` reads "a verification defect, unless it removes the only real evidence of the change's safety". `policy.log.max-observations` is gone with the per-dispatch observation cap (T23-D13).

#### Scenario: extend the blocking categories

- **WHEN** the `policy` module is registered and `.bdk/settings.yaml` adds a `policy.verifier.blocking-categories` item with `id: accessibility`
- **THEN** the resolved list holds the seven default categories followed by `accessibility`

#### Scenario: T22 defaults

- **WHEN** no layer sets a `policy` key and `bdk config show policy --json` runs
- **THEN** the budgets are `part: 3`, `verify-fix: 2`, `review-fix: 2`, `verifier: 2`, `not-run: 3`, `oscillation.threshold` is 2, `escalation` is `{enabled: true, model: opus, per-change: 3}` and `checkpoint.enabled` is true

#### Scenario: not-a-fail defaults

- **WHEN** no layer sets `policy.verifier` and `bdk config show policy.verifier --json` runs
- **THEN** `blocking-categories` holds the six P8 categories and `costly-command` (#166), and `not-a-fail` holds `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length` and `verification-defect`

#### Scenario: removed loop budgets

- **WHEN** `.bdk/settings.yaml` sets `policy.budgets.task-redispatch: 3` or `policy.budgets.part-lead: 2`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming the key

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                                | Type              | Default                   | Owner | Consumer | v2 origin |
| ---------------------------------- | ----------------- | ------------------------- | ----- | -------- | --------- |
| `execution.concurrency`            | integer 1 to 15   | `5`                       | T23   | `ctx`    | none      |
| `execution.checks.timeout`         | integer 10 to 540 | `300`                     | T22   | `check`  | none      |
| `execution.worktree.enabled`       | boolean           | `true`                    | T45   | `graph`  | none      |
| `execution.worktree.dir`           | non-empty string  | `.bdk/.machine/worktrees` | T45   | `graph`  | none      |
| `execution.worktree.setup.command` | non-empty string  | none                      | T45   | `graph`  | none      |
| `execution.worktree.setup.timeout` | integer 10 to 540 | `300`                     | T45   | `graph`  | none      |
| `execution.worktree.max-live`      | integer 1 to 15   | `3`                       | T45   | `graph`  | none      |
| `plan.part.max-tasks`              | integer 1 to 8    | `5`                       | T22   | `graph`  | none      |
| `plan.part.max-files`              | integer 1 to 30   | `10`                      | T22   | `graph`  | none      |
| `archive.keep-evidence`            | boolean           | `false`                   | T30   | `change` | none      |

`execution.concurrency` caps how many dispatches of one wave the orchestrator runs at once through the host's own subagents; the kernel runs no dispatch process itself, so there is no runner or host key. `ctx` consumes it: the swarm skill's context (`bdk ctx skill swarm`) carries a `Concurrency` section stating the resolved value (T23-D52). `execution.tree` is gone with the lead (#166): every part runs as one `part` ticket, so a layer setting `execution.tree.enabled` or `execution.tree.min-parts` gets `policy/unknown-config-key`. `execution.checks` is its own module, consumed by `check`: `timeout` bounds each command `bdk check run` runs, in seconds, and its upper bound keeps one call inside the 600 s limit of a host's shell tool (`kernel-cli/check`). `plan.part` is its own module, consumed by `graph`, whose `plan-part` checks `tasks` and `files` apply it (`kernel-loops`, Plan part checks): one agent implements a whole part, so the limits bound what that agent holds in its context; `max-tasks` stays at or below the 8 tasks a part could hold before. No `features.workflow` key exists: a layer setting it gets `policy/unknown-config-key` (user decision 2026-10-01, Change `v3-t41-execute`). `archive.keep-evidence: true` keeps the full `dispatch/` and `reports/` bodies in the archived Change; by default `change close` replaces them with their hash index (`kernel-state`, Pruned index; T23-D53). T30 registers its module with its consumer, `change close`.

`execution.worktree` is its own module, consumed by `graph`, which applies `enabled` and `max-live` in the wave of `bdk next`; `part start` and `part done` read the module through `graph/index.ts` (`kernel-state`, Part worktree; T45). `enabled: false` is the only downgrade of a part with `isolation: worktree`: the part then runs in the home checkout and alone in its wave. `dir` is resolved against the project root of the home checkout, or used as is when absolute, so a project can keep worktrees outside the repository; it is the user's job then to let the host's agents edit there. `setup.command` runs in a new worktree through the shell, with the worktree as working directory, after the `.worktreeinclude` files are copied; without it no setup runs. `setup.timeout` bounds it in seconds; the upper bound keeps one `part start` inside the 600 s limit of a host's shell tool. `max-live` bounds the disk: a part not started with `isolation: worktree` waits for a later wave while that many kernel worktrees of the project exist. The gitignored files a worktree needs are listed in `.worktreeinclude` at the project root (gitignore syntax: a file is copied when it matches a pattern and is ignored by git), the file Claude Code reads for its own worktrees, so no settings key lists them.

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

#### Scenario: no workflow switch

- **WHEN** `.bdk/settings.yaml` sets `features.workflow: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `features.workflow`

#### Scenario: worktree defaults

- **WHEN** no layer sets `execution.worktree` and `bdk config show execution.worktree --json` runs
- **THEN** the value is `{enabled: true, dir: .bdk/.machine/worktrees, setup: {timeout: 300}, max-live: 3}`

#### Scenario: setup timeout out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.worktree.setup.timeout: 900`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.worktree.setup.timeout`

#### Scenario: tree keys removed

- **WHEN** `.bdk/settings.yaml` sets `execution.tree.enabled: false`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `execution.tree.enabled`

#### Scenario: checks and part defaults

- **WHEN** no layer sets `execution.checks` or `plan.part` and `bdk config show execution.checks --json` and `bdk config show plan.part --json` run
- **THEN** the values are `{timeout: 300}` and `{max-tasks: 5, max-files: 10}`

#### Scenario: part limit out of range

- **WHEN** `.bdk/settings.yaml` sets `plan.part.max-tasks: 9`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `plan.part.max-tasks`

#### Scenario: tree defaults

- **WHEN** no layer sets `execution.tree` and `bdk config show execution.tree` runs
- **THEN** the exit code is 2 with `rule: policy/unknown-config-key`, since the module is gone (#166)

#### Scenario: tree threshold out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.tree.min-parts: 1`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `execution.tree.min-parts`

### Requirement: Setup classification

Every leaf key of the registry SHALL carry exactly one setup class, declared by the config module that registers it, beside its schema:

- `derived`: `/bdk:setup` reads the value from the project files and shows it for confirmation, without a question about the key itself;
- `asked`: a project fact the files cannot tell; `/bdk:setup` asks the user;
- `default`: `/bdk:setup` leaves the key on its default on purpose and names it in its closing report.

A module declares one class for all its leaves or one class per leaf, by the leaf's path below the module key. The registry SHALL fail at startup when a module leaves a leaf without a class or names a path that is not one of its leaves, as it fails on two overlapping module keys (requirement "Registry and consumers"). A leaf is a key path as the key tables list it: an array merged by id (`review.risks`, `tools.test`) is one leaf, and a free-form mapping is one leaf ending in `<key>` (`prompts.files.<key>`).

The classes are recorded in the table below, which the classification of the registry SHALL equal. A contract test fails `pnpm test:contract` when a registered leaf has no row, a row names a key the registry does not declare, or a row's class differs from the module's, so a key a later task registers cannot reach a release without a class. The setup skill reads the classes through its context (`kernel-cli/ctx`, bdk ctx skill), never from its own text.

| Setup key                             | Class     | What setup does                                                                                 |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `languages`                           | `derived` | Detects the languages and frameworks from the project files.                                    |
| `tools.test`                          | `derived` | Detects the test commands; the user confirms them, or declares none.                            |
| `tools.lint`                          | `derived` | Detects the lint, format and type check commands; the user confirms them, or declares none.     |
| `tools.build`                         | `derived` | Detects the build commands; the user confirms them.                                             |
| `features.lavish`                     | `derived` | Checks that Lavish runs; `false` when it does not and the user declines the install.            |
| `execution.worktree.setup.command`    | `derived` | Derives the dependency install command from the lockfile; the user confirms it.                 |
| `policy.evidence.build-config`        | `derived` | Appends the Markdown or text sources the project builds or tests from (a docs build, fixtures). |
| `policy.evidence.non-executable`      | `derived` | Appends the documentation and image formats the project uses beyond the defaults.               |
| `spec.normative-word`                 | `derived` | Reads the word the project's existing requirements carry; left on `SHALL` when there are none.  |
| `policy.gates.design`                 | `asked`   | Asks who passes the design gate.                                                                |
| `policy.gates.review`                 | `asked`   | Asks who passes the review gate.                                                                |
| `review.risks`                        | `asked`   | Shows which files each default risk matches; asks which to keep and which risks to add.         |
| `tracker`                             | `asked`   | Proposes GitHub issues when `gh` and `origin` allow it, otherwise asks where findings go.       |
| `rules.warn-above`                    | `default` |                                                                                                 |
| `rules.disabled`                      | `default` |                                                                                                 |
| `rules.audit.min-changes`             | `default` |                                                                                                 |
| `rules.prune.uncited-changes`         | `default` |                                                                                                 |
| `execution.concurrency`               | `default` |                                                                                                 |
| `execution.checks.timeout`            | `default` |                                                                                                 |
| `execution.worktree.enabled`          | `default` |                                                                                                 |
| `execution.worktree.dir`              | `default` |                                                                                                 |
| `execution.worktree.setup.timeout`    | `default` |                                                                                                 |
| `execution.worktree.max-live`         | `default` |                                                                                                 |
| `plan.part.max-tasks`                 | `default` |                                                                                                 |
| `plan.part.max-files`                 | `default` |                                                                                                 |
| `policy.budgets.part`                 | `default` |                                                                                                 |
| `policy.budgets.verify-fix`           | `default` |                                                                                                 |
| `policy.budgets.review-fix`           | `default` |                                                                                                 |
| `policy.budgets.verifier`             | `default` |                                                                                                 |
| `policy.budgets.not-run`              | `default` |                                                                                                 |
| `policy.oscillation.threshold`        | `default` |                                                                                                 |
| `policy.escalation.enabled`           | `default` |                                                                                                 |
| `policy.escalation.model`             | `default` |                                                                                                 |
| `policy.escalation.per-change`        | `default` |                                                                                                 |
| `policy.verifier.blocking-categories` | `default` |                                                                                                 |
| `policy.verifier.not-a-fail`          | `default` |                                                                                                 |
| `policy.evidence.max-committed-bytes` | `default` |                                                                                                 |
| `policy.checkpoint.enabled`           | `default` |                                                                                                 |
| `archive.keep-evidence`               | `default` |                                                                                                 |
| `agents.ttl`                          | `default` |                                                                                                 |
| `agents.open-call-limit`              | `default` |                                                                                                 |
| `agents.message.max-chars`            | `default` |                                                                                                 |
| `agents.continuation.max`             | `default` |                                                                                                 |
| `agents.scout.max-per-ticket`         | `default` |                                                                                                 |
| `diagnostics.verbose`                 | `default` |                                                                                                 |
| `diagnostics.repeat-refusal`          | `default` |                                                                                                 |
| `diagnostics.repeat-read`             | `default` |                                                                                                 |
| `diagnostics.outlier-factor`          | `default` |                                                                                                 |
| `review.group.max-files`              | `default` |                                                                                                 |
| `prompts.dir`                         | `default` |                                                                                                 |
| `prompts.files.<key>`                 | `default` |                                                                                                 |

A key is `asked` only when it is a fact of the project or a decision of its team that no file holds; a key whose right value is learned by running Changes (budgets, concurrency, thresholds) is `default`, and a person sets it later with `bdk config set`. A key's class changes through a delta of this table, like its default.

#### Scenario: every key classified

- **WHEN** `pnpm test:contract` runs on the repository
- **THEN** every registered leaf has a row in the setup table with the class its module declares, and every row names a registered leaf

#### Scenario: new key without a class

- **WHEN** a module registers a new leaf and declares no class for it
- **THEN** the registry fails at startup naming the module and the leaf, and `pnpm test:contract` fails

#### Scenario: class differs from the table

- **WHEN** a module declares `policy.gates.design` as `default` while the table says `asked`
- **THEN** the contract test fails naming `policy.gates.design`

#### Scenario: class names no leaf

- **WHEN** a module `execution.worktree` declares a class for `setup.cmd`, which is not one of its leaves
- **THEN** the registry fails at startup naming `execution.worktree` and `setup.cmd`
