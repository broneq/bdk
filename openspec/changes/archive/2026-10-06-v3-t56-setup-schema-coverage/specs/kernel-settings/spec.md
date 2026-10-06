## ADDED Requirements

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
| `execution.tree.enabled`              | `default` |                                                                                                 |
| `execution.tree.min-parts`            | `default` |                                                                                                 |
| `execution.worktree.enabled`          | `default` |                                                                                                 |
| `execution.worktree.dir`              | `default` |                                                                                                 |
| `execution.worktree.setup.timeout`    | `default` |                                                                                                 |
| `execution.worktree.max-live`         | `default` |                                                                                                 |
| `policy.budgets.task-redispatch`      | `default` |                                                                                                 |
| `policy.budgets.verify-fix`           | `default` |                                                                                                 |
| `policy.budgets.review-fix`           | `default` |                                                                                                 |
| `policy.budgets.verifier`             | `default` |                                                                                                 |
| `policy.budgets.part-lead`            | `default` |                                                                                                 |
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
