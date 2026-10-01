## MODIFIED Requirements

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

## ADDED Requirements

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
