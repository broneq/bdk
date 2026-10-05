## ADDED Requirements

### Requirement: The bdk-craft plugin

The repository SHALL hold a second plugin, `bdk-craft`, at `plugins/bdk-craft/`: a `.claude-plugin/plugin.json` with `name: bdk-craft` and its own `version`, and its skills under `plugins/bdk-craft/skills/<name>/SKILL.md`. `.claude-plugin/marketplace.json` SHALL list it as an entry named `bdk-craft` with the source `{"source": "git-subdir", "url": "broneq/bdk", "path": "plugins/bdk-craft"}`. The plugin SHALL need no build step and SHALL ship no hook, agent, MCP server, script or kernel file. Release-please SHALL version it as its own package, with `plugins/bdk-craft/.claude-plugin/plugin.json` as its version file.

#### Scenario: manifest and marketplace

- **WHEN** the content test reads `plugins/bdk-craft/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
- **THEN** the manifest names `bdk-craft`, the marketplace lists `bdk-craft` with that `git-subdir` source, and `claude plugin validate plugins/bdk-craft` passes

#### Scenario: nothing but skills

- **WHEN** the content test lists `plugins/bdk-craft/`
- **THEN** it holds only `.claude-plugin/`, `skills/`, a `README.md` and a `CHANGELOG.md`

### Requirement: Craft skill shape

A craft skill SHALL run on any Agent Skills host and without `bdk` (R-1). Each `SKILL.md` SHALL:

- use only the six Agent Skills standard fields and pass `pnpm skill-check` in the portable target over `plugins/bdk-craft/skills`, with no baseline entry;
- stay at or below 200 lines;
- contain no `!` block, no `${CLAUDE_PLUGIN_ROOT}`, no `bdk.mjs`, no `/bdk:` reference and no model name;
- encode a process with checkable steps or a concrete choice among named alternatives (R-6), not a summary of general knowledge;
- keep every supporting file under its own `references/`, linked from `SKILL.md`.

#### Scenario: portable check

- **WHEN** `pnpm skill-check` runs
- **THEN** the portable target covers every skill under `plugins/bdk-craft/skills` and reports no finding

#### Scenario: no kernel

- **WHEN** the content test reads every file under `plugins/bdk-craft/skills`
- **THEN** none names `bdk.mjs`, `CLAUDE_PLUGIN_ROOT`, a `/bdk:` skill or a model

### Requirement: The nine craft skills

`bdk-craft` SHALL offer these skills, each shipped only when admitted (Admission by measurement):

| Skill              | What it fixes                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tdd`              | Red, green, refactor with gates: one failing test per behaviour, the failure observed for the stated reason before any implementation, the smallest passing change, refactor only on green.     |
| `debugging`        | Reproduce first as a failing test; rank hypotheses by evidence; narrow by bisection (inputs, commits); fix the cause, not the symptom; keep the reproduction as the regression test.            |
| `mermaid-drawer`   | The diagram type chosen by the relationship, a node budget, labelled edges, and colour that sets fill, stroke and text together.                                                                |
| `oop-design`       | Concrete choices: composition before inheritance, value objects for domain values, constructor injection, tell-don't-ask, and when a strategy or state pattern replaces a conditional.          |
| `api-design`       | Concrete choices for HTTP APIs: resource naming, the status code per outcome, `application/problem+json` errors, cursor pagination, idempotency keys for unsafe retries, additive versioning.   |
| `refactoring`      | Characterisation tests before the first change, one named refactoring per step, tests green after each step, no behaviour change mixed in.                                                      |
| `data-modeling`    | Entities from the use cases, constraints in the database, normalisation with each denormalisation justified, expand-and-contract migrations.                                                    |
| `testing-strategy` | What each test level owns, mocks only at boundaries the project owns, the Test Data Builder for test data, the Page Object Model for UI end-to-end tests, contract tests at service boundaries. |
| `modularizing`     | Modules by domain feature rather than by technical layer, one public entry per module, dependencies pointing one way with no cycle, and the signals that a module should split.                 |

Every skill SHALL be model-invocable and user-invocable, with a description that names when to use it.

#### Scenario: shipped skills are admitted

- **WHEN** the content test lists `plugins/bdk-craft/skills`
- **THEN** every directory is one of the nine names and has an `admitted` row in the craft measurement report

### Requirement: Admission by measurement

A craft skill SHALL be shipped only after a with / without probe on a task file of its own shows that the `with` cell beats the `without` cell (`skill-evals`, With / without mode). Each task file SHALL hold at least three tasks under `evals/suites/with-without/examples/craft/<name>.yaml`, written as a user would ask without naming the skill, with assertions on what the skill fixes. A skill is admitted when, summed over its tasks, the `with` cell passes more assertions than the `without` cell. A skill that is not admitted SHALL be deleted from `plugins/bdk-craft/skills`, and its task file kept. `docs/V3-EVAL-CRAFT.md` SHALL list every one of the nine skills with its task file, the assertions passed per cell, the cost, and the verdict `admitted` or `rejected`.

#### Scenario: rejected skill

- **WHEN** a probe shows the `without` cell passing as many assertions as the `with` cell
- **THEN** the skill's directory is absent from `plugins/bdk-craft/skills` and the report lists it as `rejected` with its numbers

### Requirement: The v2 craft skills leave bdk

`bdk` SHALL NOT ship `skills/debug/`, `skills/test-driven-development/` or `skills/mermaid-drawer/`, and the `ctx skill` manifest SHALL hold no entry for `debug` or `test-driven-development`. Nothing in the repository outside `docs/v3/`, `docs/V3-*.md`, `CHANGELOG.md`, `openspec/changes/archive/`, the recorded host payloads under `tests/fixtures/host-payloads/`, the legacy evals under `tests/evals/` and the "Removed skills" sections of `README.md` and `docs/guide/reference/skills.md` SHALL name `/bdk:debug`, `/bdk:test-driven-development` or `/bdk:mermaid-drawer`. The "Removed skills" sections SHALL map them to `bdk-craft:debugging` with `/bdk:change` of kind `bug`, `bdk-craft:tdd`, and `bdk-craft:mermaid-drawer`.

#### Scenario: removed directories

- **WHEN** the content test checks the three v2 paths
- **THEN** none exists, and `SKILL_CONTEXT` has no `debug` or `test-driven-development` key

#### Scenario: no stale name

- **WHEN** the content test searches the skills, agents, rules, fragments, `README.md`, `STARTUP_INSTRUCTIONS.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/` and `docs/guide/` for the three names, skipping the two "Removed skills" sections
- **THEN** it finds none
