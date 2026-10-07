# Spec Delta

## Purpose

Defines the `bdk-craft` plugin: a set of craft knowledge skills that installs and works on its own, where every shipped skill carries recorded with/without eval evidence that it changes the outcome over no plugin.

## ADDED Requirements

### Requirement: bdk-craft is a skills-only plugin that works alone
The directory `plugins/bdk-craft/` SHALL hold a plugin named `bdk-craft` whose runtime files are its manifest, `README.md` and `skills/`. It SHALL ship no hooks, agents, MCP servers, CLI or `package.json`, and no skill in it SHALL require another plugin, a `bdk` command or a `!` shell block to work.

#### Scenario: Strict validation
- **WHEN** `claude plugin validate plugins/bdk-craft --strict` runs
- **THEN** it passes

#### Scenario: Loaded without bdk
- **WHEN** an eval run loads `plugins/bdk-craft` as the only plugin and a case prompt matches a shipped skill's description
- **THEN** the run can invoke that skill as `bdk-craft:<name>` with no other plugin present

### Requirement: Every shipped craft skill shows an effect over no plugin
A skill SHALL be shipped under `plugins/bdk-craft/skills/` only when its eval cases under `plugins/bdk-craft/evals/`, run with `claude plugin eval` in two arms (with `bdk-craft` and with no plugin), pass the admission rule: the mean of the skill's per-case `Δ` (with-arm score minus without-arm score) is at least `+0.10`, and the skill was invoked in at least half of its with-arm runs. Each skill SHALL have at least two eval cases, each run at least three times per arm.

#### Scenario: Admitted skill
- **WHEN** a skill's cases score a mean `Δ` of `+0.25` and the skill fired in 7 of 9 with-arm runs
- **THEN** the skill is admitted and stays in `skills/`

#### Scenario: Skill without an effect
- **WHEN** a skill's cases score a mean `Δ` of `+0.05`, or the skill fired in fewer than half of its with-arm runs
- **THEN** the skill is rejected, its directory and its eval cases are removed from the plugin, and its numbers stay in the admission record

### Requirement: Admission evidence is recorded and checked
`plugins/bdk-craft/evals/RESULTS.md` SHALL record, for every candidate skill, its cases with their `WITH`, `W/OUT` and `Δ` scores, its skill-fired count, the model, the Claude Code version, the date, and a verdict of `admitted` or `rejected`. The workspace tests SHALL fail when a directory under `plugins/bdk-craft/skills/` has no `admitted` row, when an `admitted` row has no skill directory, or when a shipped skill has fewer than two eval cases.

#### Scenario: Skill added without evidence
- **WHEN** a contributor adds `plugins/bdk-craft/skills/new-skill/SKILL.md` and no `admitted` row for `new-skill` exists in `RESULTS.md`
- **THEN** `pnpm test` fails and names `new-skill`

#### Scenario: Rejected skill left in the plugin
- **WHEN** `RESULTS.md` records `oop-design` as `rejected` and `plugins/bdk-craft/skills/oop-design/` still exists
- **THEN** `pnpm test` fails and names `oop-design`
