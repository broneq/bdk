## MODIFIED Requirements

### Requirement: Agent blocks are started as agents and can be continued

`explore` SHALL run on the agent `bdk:explorer` and `verify-design` on the agent `bdk:verifier`. A caller SHALL start such a block as an agent of that type whose prompt runs the block's skill with its arguments, so the caller receives the agent's ID and can continue the same agent with `SendMessage`. When a user invokes the skill in the main thread, the skill SHALL start its agent that way, with the model `models.explorer` (for `explore`) or `models.verifier` (for `verify-design`) when the configuration sets it, wait for it, and reply with the agent's result; the main thread SHALL NOT do the block's work itself.

#### Scenario: Typed by the user

- **WHEN** a user types `/bdk:verify-design add-csv-export` in the main thread
- **THEN** a `bdk:verifier` agent writes `.bdk/runs/add-csv-export/design/verify-1.md`, and the main thread replies with its verdict line and the report path

#### Scenario: Typed by the user with a model set

- **WHEN** a user types `/bdk:explore add-csv-export` in the main thread of a project whose configuration sets `models.explorer: sonnet`
- **THEN** the skill starts the `bdk:explorer` agent with `model` `sonnet`

#### Scenario: Continued with SendMessage

- **WHEN** a caller started `verify-design` as a `bdk:verifier` agent, the report said `Verdict: FAIL`, the design was fixed, and the caller sends that agent a message to verify again
- **THEN** the same agent writes the next report `verify-2.md`
