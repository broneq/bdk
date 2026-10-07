# Spec Delta

## MODIFIED Requirements

### Requirement: Agents the plugin ships

The plugin's `agents/` SHALL hold exactly the eight adapters of `role-contracts`, Adapters (`lead`, `worker`, `reader`, `integrator`, `judge`, `reviewer`, `runner`, `scout`) and `web-researcher`, a hand-written agent for any session that runs without the kernel and stays outside the role inventory. The twelve v2 agents the adapters replace SHALL NOT exist: `implementer`, `fixer`, `plan-verifier`, `design-verifier`, `code-reviewer`, `architecture-reviewer`, `test-runner`, `static-analyse`, `explorer`, `log-analyzer`, `dead-code-detector` and `duplicate-detector` (T42-E). No skill, agent, rule file of `rules/`, `STARTUP_INSTRUCTIONS.md` or user guide page other than the migration page `docs/guide/getting-started/migration-from-v2.md`, which maps each of them to its adapter, SHALL name one of them as `bdk:<name>`. The agents table of `STARTUP_INSTRUCTIONS.md` SHALL stay byte-identical to `bdk ctx startup` (P11), and `bdk export agents --host claude --check` SHALL pass.

#### Scenario: v2 agents removed

- **WHEN** the content test lists `agents/`
- **THEN** it finds `lead.md`, `worker.md`, `reader.md`, `integrator.md`, `judge.md`, `reviewer.md`, `runner.md`, `scout.md` and `web-researcher.md` and nothing else

#### Scenario: no reference to a removed agent

- **WHEN** `git grep -nE "bdk:(implementer|fixer|plan-verifier|design-verifier|code-reviewer|architecture-reviewer|test-runner|static-analyse|explorer|log-analyzer|dead-code-detector|duplicate-detector)\b"` runs over `skills/`, `agents/`, `rules/`, `hooks/`, `STARTUP_INSTRUCTIONS.md`, `README.md` and `docs/guide/`, without the migration page
- **THEN** it finds nothing, because the role names `bdk:implementer` and `bdk:design-verifier` are role skills reached through `bdk:worker` and `bdk:reader` packages, never written as `subagent_type`

#### Scenario: export stays green

- **WHEN** the v2 agents are deleted and `bdk export agents --host claude --check` runs
- **THEN** the exit code is 0, and the STARTUP agents table lists exactly the nine remaining agents
