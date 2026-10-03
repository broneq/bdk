## ADDED Requirements

### Requirement: Agents the plugin ships

The plugin's `agents/` SHALL hold exactly the six adapters of `role-contracts`, Adapters (`lead`, `worker`, `reader`, `reviewer`, `runner`, `scout`) and `web-researcher`, which is outside the v3 inventory until T50 decides on it. The twelve v2 agents the adapters replace SHALL NOT exist: `implementer`, `fixer`, `plan-verifier`, `design-verifier`, `code-reviewer`, `architecture-reviewer`, `test-runner`, `static-analyse`, `explorer`, `log-analyzer`, `dead-code-detector` and `duplicate-detector` (T42-E). No skill, agent, rule file of `rules/`, `STARTUP_INSTRUCTIONS.md` or user guide page SHALL name one of them as `bdk:<name>`. The agents table of `STARTUP_INSTRUCTIONS.md` SHALL stay byte-identical to `bdk ctx startup` (P11), and `bdk export agents --host claude --check` SHALL pass.

#### Scenario: v2 agents removed

- **WHEN** the content test lists `agents/`
- **THEN** it finds `lead.md`, `worker.md`, `reader.md`, `reviewer.md`, `runner.md`, `scout.md` and `web-researcher.md` and nothing else

#### Scenario: no reference to a removed agent

- **WHEN** `git grep -nE "bdk:(implementer|fixer|plan-verifier|design-verifier|code-reviewer|architecture-reviewer|test-runner|static-analyse|explorer|log-analyzer|dead-code-detector|duplicate-detector)\b"` runs over `skills/`, `agents/`, `rules/`, `hooks/`, `STARTUP_INSTRUCTIONS.md`, `README.md` and `docs/guide/`
- **THEN** it finds nothing, because the role names `bdk:implementer` and `bdk:design-verifier` are role skills reached through `bdk:worker` and `bdk:reader` packages, never written as `subagent_type`

#### Scenario: export stays green

- **WHEN** the v2 agents are deleted and `bdk export agents --host claude --check` runs
- **THEN** the exit code is 0, and the STARTUP agents table lists exactly the seven remaining agents

### Requirement: No BDK meta-skills

The plugin SHALL ship no `bdk-*` meta-skill: `bdk-rules-architecture`, `bdk-rules-code-quality`, `bdk-rules-design-patterns`, `bdk-rules-languages`, `bdk-rules-security`, `bdk-lint-tools`, `bdk-test-tools` and `bdk-implementer-return-contract` SHALL NOT exist (T42-E). Rules reach an agent through `bdk rules show`, project commands through a runner package's `Checks` section, and the return contract through the role skill.

#### Scenario: meta-skills removed

- **WHEN** the content test lists `skills/`
- **THEN** no directory name starts with `bdk-`, and the kernel's context manifest holds no `bdk-*` entry

### Requirement: Tools skills directory

`.claude-plugin/plugin.json` SHALL list `./skills/tools/` in its `skills` array beside `./skills/roles/` and `./skills/stages/` (T02 table 13.2), and `cr` and `pr-review` SHALL live there. A skill directory SHALL exist only once across `skills/`, `skills/stages/`, `skills/tools/` and `skills/roles/`, so every `/bdk:<name>` resolves to one skill.

#### Scenario: review skills under tools

- **WHEN** the plugin loads
- **THEN** `/bdk:cr` and `/bdk:pr-review` resolve to `skills/tools/cr/SKILL.md` and `skills/tools/pr-review/SKILL.md`, no `skills/cr/` or `skills/pr-review/` exists, and `claude plugin validate` passes
