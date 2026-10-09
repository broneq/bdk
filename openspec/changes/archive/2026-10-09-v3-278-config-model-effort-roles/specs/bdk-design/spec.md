## MODIFIED Requirements

### Requirement: The orchestrator only composes the design blocks

The skill SHALL run the design blocks in this order: `explore` as a `bdk:explorer` agent, `design-draft` as a `bdk:designer` agent whose prompt runs the skill `bdk:design-draft`, and `verify-design` as a `bdk:verifier` agent whose prompt runs the skill `bdk:verify-design`, each agent with `model` and `effort` from `models.explorer`, `models.designer` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says. When the designer ends with open questions, the skill SHALL ask them as spec `design-blocks` ("Questions follow the policy and the session") says and pass the answers back to the designer. It SHALL NOT map the code, write or fix a spec delta or `design.md`, or check the design itself. The only file it SHALL write is the gate file `.bdk/runs/<change>/design/gate.md`. It SHALL NOT commit, create a branch or start the plan stage.

#### Scenario: Full design of a fresh Change

- **WHEN** `/bdk:design add-csv-export` runs for a Change that has a `proposal.md` and no run files, with `policy.questions: decide-and-record` and `policy.gates.design: auto`
- **THEN** a `bdk:explorer` agent starts before a `bdk:designer` agent starts, the designer starts before a `bdk:verifier` agent starts, and `.bdk/runs/add-csv-export/design/explore.md`, `openspec/changes/add-csv-export/design.md`, the spec delta and `.bdk/runs/add-csv-export/design/verify-1.md` exist

#### Scenario: Models of the design agents

- **WHEN** `/bdk:design add-csv-export` runs for a fresh Change with `models.explorer.model: sonnet`, `models.designer.effort: high` and `models.verifier.model: sonnet`
- **THEN** the `bdk:explorer` agent and the `bdk:verifier` agent both start with `model` `sonnet`, and the `bdk:designer` agent starts with `effort` `high`
