## MODIFIED Requirements

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
