## MODIFIED Requirements

### Requirement: The v2 craft skills leave bdk

`bdk` SHALL NOT ship `skills/debug/`, `skills/test-driven-development/` or `skills/mermaid-drawer/`, and the `ctx skill` manifest SHALL hold no entry for `debug` or `test-driven-development`. Nothing in the repository outside `docs/v3/`, `docs/V3-*.md`, `CHANGELOG.md`, `openspec/changes/archive/`, the recorded host payloads under `tests/fixtures/host-payloads/` and the "Removed skills" sections of `README.md` and `docs/guide/reference/skills.md` SHALL name `/bdk:debug`, `/bdk:test-driven-development` or `/bdk:mermaid-drawer`. The "Removed skills" sections SHALL map them to `bdk-craft:debugging` with `/bdk:change` of kind `bug`, `bdk-craft:tdd`, and `bdk-craft:mermaid-drawer`.

#### Scenario: removed directories

- **WHEN** the content test checks the three v2 paths
- **THEN** none exists, and `SKILL_CONTEXT` has no `debug` or `test-driven-development` key

#### Scenario: no stale name

- **WHEN** the content test searches the skills, agents, rules, fragments, `README.md`, `STARTUP_INSTRUCTIONS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/` and `docs/guide/` for the three names, skipping the two "Removed skills" sections
- **THEN** it finds none
