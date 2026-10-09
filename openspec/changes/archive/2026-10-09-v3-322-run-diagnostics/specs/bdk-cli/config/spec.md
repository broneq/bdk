## MODIFIED Requirements

### Requirement: Every agent is a models role

Every agent the `bdk` plugin ships (`plugins/bdk/agents/<name>.md`) SHALL be a role of `models`, named by the agent's file name: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester`, `judge`, `designer`, `planner` and `analyst`; the schema SHALL accept exactly these roles. The description of `models` in the settings schema SHALL name every one of them. Every skill of the plugin that starts one of these agents SHALL set the `Agent` call's `model` to `models.<agent>.model` and its `effort` to `models.<agent>.effort`, each only when the configuration sets it, and leave the field out when it does not, so the agent runs on the model of its frontmatter (the session's model for `model: inherit`) and at the session's effort level; the only exception SHALL be the last implementer run of a plan part and the second `resolve-conflict` run, which run on `policy.escalation.model` and `policy.escalation.effort` (spec `bdk-execute`). A workspace test SHALL fail and name the agent when an agent file is not a role of the `models` description or of the schema, and SHALL fail and name the skill when a paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` does not name `models.<agent>`.

#### Scenario: Verifier model in every stage

- **WHEN** the configuration sets `models.verifier.model: sonnet` and `/bdk:design`, `/bdk:plan` and `/bdk:close` start their verifier
- **THEN** each `Agent` call with `subagent_type: "bdk:verifier"` has `model` `sonnet`

#### Scenario: Explorer model

- **WHEN** the configuration sets `models.explorer.model: sonnet` and `/bdk:design` maps the code of a Change
- **THEN** the `Agent` call with `subagent_type: "bdk:explorer"` has `model` `sonnet`

#### Scenario: Role not set

- **WHEN** the configuration sets no `models.explorer`
- **THEN** the `Agent` call with `subagent_type: "bdk:explorer"` has neither `model` nor `effort`, and the explorer runs on `haiku`, the model of its frontmatter

#### Scenario: Implementer with model and effort

- **WHEN** the configuration sets `models.implementer.model: sonnet` and `models.implementer.effort: low`, and a user types `/bdk:implement-part add-csv-export 01`
- **THEN** the `Agent` call that starts `bdk:implementer` has `model` `sonnet` and `effort` `low`

#### Scenario: Effort without a model

- **WHEN** the configuration sets only `models.reviewer.effort: high`
- **THEN** every `Agent` call that starts `bdk:reviewer` has `effort` `high` and no `model`

#### Scenario: New agent without a role

- **WHEN** a contributor adds `plugins/bdk/agents/stylist.md` and leaves the `models` description unchanged
- **THEN** `pnpm check` fails and names `stylist`

#### Scenario: Agent call without its model

- **WHEN** a skill starts `subagent_type: "bdk:verifier"` in a paragraph that does not name `models.verifier`
- **THEN** `pnpm check` fails and names that skill

#### Scenario: Analyst model

- **WHEN** the configuration sets `models.analyst.model: opus` and a user types `/bdk:diagnose-run add-total`
- **THEN** the `Agent` call that starts `bdk:analyst` has `model` `opus`
