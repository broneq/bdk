## MODIFIED Requirements

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                     | Type            | Default | Owner | Consumer   | v2 origin |
| ----------------------- | --------------- | ------- | ----- | ---------- | --------- |
| `execution.concurrency` | integer 1 to 15 | `5`     | T23   | `dispatch` | none      |
| `archive.keep-evidence` | boolean         | `false` | T23   | `change`   | none      |

`execution.concurrency` caps how many dispatches of one wave the orchestrator runs at once through the host's own subagents (the swarm skill of T23); the kernel runs no dispatch process itself, so there is no runner or host key.

#### Scenario: concurrency default

- **WHEN** the `execution` module is registered, no layer sets `execution.concurrency` and `bdk config show execution.concurrency --json` runs
- **THEN** the exit code is 0 and the value is `5`

#### Scenario: detected key unset

- **WHEN** the `execution` module is registered and `bdk config show execution.runner` runs
- **THEN** the exit code is 2 with `rule: policy/unknown-config-key`, because the module declares no runner or host key

#### Scenario: removed runner key in a layer

- **WHEN** `.bdk/settings.yaml` sets `execution.runner: headless`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `execution.runner`
