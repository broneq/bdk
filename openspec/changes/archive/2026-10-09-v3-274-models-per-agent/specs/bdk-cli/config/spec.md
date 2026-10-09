## ADDED Requirements

### Requirement: Every agent is a models role

Every agent the `bdk` plugin ships (`plugins/bdk/agents/<name>.md`) SHALL be a role of `models`, named by the agent's file name: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester` and `judge`. The description of `models` in the settings schema SHALL name every one of them. Every skill of the plugin that starts one of these agents SHALL pass the `Agent` call's `model` set to `models.<agent>` when the configuration sets it, and no `model` when it does not, so the agent runs on the model of its frontmatter; the only exception SHALL be the last implementer run of a plan part, which runs on `policy.escalation.model` (spec `bdk-execute`). A workspace test SHALL fail and name the agent when an agent file is not a role of the `models` description, and SHALL fail and name the skill when a paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` does not name `models.<agent>`.

#### Scenario: Verifier model in every stage

- **WHEN** the configuration sets `models.verifier: sonnet` and `/bdk:design`, `/bdk:plan` and `/bdk:close` start their verifier
- **THEN** each `Agent` call with `subagent_type: "bdk:verifier"` has `model` `sonnet`

#### Scenario: Explorer model

- **WHEN** the configuration sets `models.explorer: sonnet` and `/bdk:design` maps the code of a Change
- **THEN** the `Agent` call with `subagent_type: "bdk:explorer"` has `model` `sonnet`

#### Scenario: Role not set

- **WHEN** the configuration sets no `models.explorer`
- **THEN** the `Agent` call with `subagent_type: "bdk:explorer"` has no `model`, and the explorer runs on `haiku`, the model of its frontmatter

#### Scenario: New agent without a role

- **WHEN** a contributor adds `plugins/bdk/agents/planner.md` and leaves the `models` description unchanged
- **THEN** `pnpm check` fails and names `planner`

#### Scenario: Agent call without its model

- **WHEN** a skill starts `subagent_type: "bdk:verifier"` in a paragraph that does not name `models.verifier`
- **THEN** `pnpm check` fails and names that skill
