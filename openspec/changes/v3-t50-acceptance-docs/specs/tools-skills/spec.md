# Spec Delta

## MODIFIED Requirements

### Requirement: The v2 tools skills are removed

The plugin SHALL NOT ship `skills/commit/`, `skills/add-rule/`, `skills/refine-rules/`, `skills/update-docs/`, `skills/explain-complex-code/` or `skills/create-adr/`. Nothing in the repository outside `docs/v3/`, `docs/V3-*.md`, `CHANGELOG.md`, `openspec/changes/archive/`, the recorded host payloads under `tests/fixtures/host-payloads/`, and the migration page `docs/guide/getting-started/migration-from-v2.md`, which maps each removed skill to its replacement, SHALL name `/bdk:add-rule`, `/bdk:refine-rules`, `/bdk:update-docs`, `/bdk:explain-complex-code` or `/bdk:create-adr`. The `skill-check` baseline SHALL hold no entry for a file of a removed skill or of `skills/tools/commit/`.

#### Scenario: removed directories

- **WHEN** the content test checks the six v2 paths
- **THEN** none exists

#### Scenario: no stale name

- **WHEN** the content test searches the skills, agents, rules, fragments, `README.md`, `STARTUP_INSTRUCTIONS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/` and `docs/guide/` for the five removed skill names, skipping the migration page
- **THEN** it finds none

#### Scenario: baseline pruned

- **WHEN** `pnpm skill-check` runs
- **THEN** it exits 0 and reports no `baseline-stale` entry, and the baseline names none of the removed files
