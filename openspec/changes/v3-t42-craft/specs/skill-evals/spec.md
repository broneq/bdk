## MODIFIED Requirements

### Requirement: With / without mode for any skill

The `with-without` suite SHALL take a skill name and a task file and run every task with the skill available and with it absent, all else equal, reporting per task and per metric whether the difference is measurable by the difference rule. A `bdk:<name>` skill runs on copies of the `bdk` plugin; a `bdk-craft:<name>` skill runs on copies of `plugins/bdk-craft` alone, without `bdk`, so the measurement also shows the skill working where `bdk` is absent. The `without` copy lacks the skill's directory in both cases.

#### Scenario: any skill

- **WHEN** `pnpm eval with-without --skill bdk:mermaid-drawer --tasks <file>` runs
- **THEN** each task runs in a `with` and a `without` cell and the report states for each metric whether the difference is measurable

#### Scenario: craft skill

- **WHEN** `pnpm eval with-without --skill bdk-craft:tdd --tasks <file>` runs
- **THEN** both cells load a copy of `plugins/bdk-craft` and no `bdk` plugin, and the `without` copy has no `skills/tdd/`
