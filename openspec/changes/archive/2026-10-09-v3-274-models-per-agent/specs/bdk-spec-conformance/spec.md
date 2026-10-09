## MODIFIED Requirements

### Requirement: Block on the verifier agent

`spec-conformance` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/spec-conformance/`) whose check runs on the agent `bdk:verifier` (spec `bdk-verifier`), never in the conversation that wrote the Change. When it is invoked anywhere else, such as a user typing `/bdk:spec-conformance` in the main thread, it SHALL start `bdk:verifier` with a prompt naming the skill and its arguments, and with the model `models.verifier` when the configuration sets it, wait for it, and reply with the agent's verdict line and report path, without checking anything itself. The block SHALL get the configuration from its own `bdk config show` block; in a project that is not configured it SHALL stop with the line that command prints and write nothing.

#### Scenario: Typed in the main thread

- **WHEN** a user types `/bdk:spec-conformance add-total` in the main thread
- **THEN** the skill starts `bdk:verifier` to run `bdk:spec-conformance` for `add-total`, and replies with the verdict line and the path of the report the agent wrote

#### Scenario: Typed in the main thread with a model set

- **WHEN** a user types `/bdk:spec-conformance add-total` in the main thread of a project whose configuration sets `models.verifier: sonnet`
- **THEN** the skill starts `bdk:verifier` with `model` `sonnet`

#### Scenario: Not configured

- **WHEN** `spec-conformance` runs in a project without `.bdk/settings.yaml`
- **THEN** it writes no file and its reply says `BDK not configured: run /bdk:setup`
