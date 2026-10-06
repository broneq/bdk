# Spec Delta

## ADDED Requirements

### Requirement: Repository rules managed by the kernel

BDK's own repository SHALL keep its development rules the way v3 asks of a user project: one file per rule under `.bdk/rules/`, each with an id and passing `bdk rules check`, and `.claude/rules/` holding only the two files `bdk rules export --claude` generates. A rule is admitted only when it passes the content admission test: it survives a refactor that changes no decision (durability), an agent would make a wrong change without it (decision), the trap is invisible where the mistake is made (visibility), and the agent cannot infer it from code, types or a failing test (derivability). A definition of how the system works lives in the spec that owns it, and a procedure lives in `CONTRIBUTING.md`, never in a rule. A contract test SHALL fail when `.claude/rules/` holds a file other than the generated projection, or when `bdk rules export --claude --check` reports drift.

#### Scenario: a hand-written rule file is added

- **WHEN** a contributor adds `.claude/rules/naming.md` by hand
- **THEN** `pnpm test:contract` fails, names the file and tells to run `bdk rules import`

#### Scenario: a rule edited without regenerating the projection

- **WHEN** a file under `.bdk/rules/` changes and `bdk rules export --claude` is not rerun
- **THEN** `pnpm test:contract` fails with the projection drift

#### Scenario: doctor on the BDK repository

- **WHEN** `bdk doctor --json` runs in the BDK repository
- **THEN** it reports no `rule-without-id`, `rules-invalid` or `projection-outdated` finding

## MODIFIED Requirements

### Requirement: Plugin names no removed MCP server

No file the plugin ships SHALL name the removed servers, their tools or `uvx`. The plugin ships `.claude-plugin/`, `skills/`, `agents/`, `rules/`, `hooks/`, `plugins/`, `STARTUP_INSTRUCTIONS.md`, `README.md`, the site pages under `docs/guide/` and the kernel sources under `kernel/src/`. Three exceptions name them on purpose: the removed-key registry `kernel/src/shared/config/known.ts`, so that `bdk config check` refuses `features.serena` and `features.code-review-graph` with the reason; the kernel's tests, which use the old keys as input and the names as text that must not appear; and the migration page `docs/guide/getting-started/migration-from-v2.md`, which tells a v2 user what became of the removed keys. The plugin layout contract test SHALL enforce this.

#### Scenario: repository search

- **WHEN** `git grep -E "mcp__plugin_bdk|code-review-graph|serena|uvx"` runs over the files the plugin ships, without the removed-key registry, the kernel's tests and the migration page
- **THEN** it finds no match

#### Scenario: a skill names a removed tool

- **WHEN** a skill under `skills/` names `mcp__plugin_bdk_serena_find_symbol`
- **THEN** `pnpm test:contract` fails and names the file, the line and the match

#### Scenario: the removed key is refused

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true`
- **THEN** `bdk config check` reports the key as a removed v2 key with its reason, and the plugin layout contract test still passes

### Requirement: Agents the plugin ships

The plugin's `agents/` SHALL hold exactly the six adapters of `role-contracts`, Adapters (`lead`, `worker`, `reader`, `reviewer`, `runner`, `scout`) and `web-researcher`, a hand-written agent for any session that runs without the kernel and stays outside the role inventory. The twelve v2 agents the adapters replace SHALL NOT exist: `implementer`, `fixer`, `plan-verifier`, `design-verifier`, `code-reviewer`, `architecture-reviewer`, `test-runner`, `static-analyse`, `explorer`, `log-analyzer`, `dead-code-detector` and `duplicate-detector` (T42-E). No skill, agent, rule file of `rules/`, `STARTUP_INSTRUCTIONS.md` or user guide page other than the migration page `docs/guide/getting-started/migration-from-v2.md`, which maps each of them to its adapter, SHALL name one of them as `bdk:<name>`. The agents table of `STARTUP_INSTRUCTIONS.md` SHALL stay byte-identical to `bdk ctx startup` (P11), and `bdk export agents --host claude --check` SHALL pass.

#### Scenario: v2 agents removed

- **WHEN** the content test lists `agents/`
- **THEN** it finds `lead.md`, `worker.md`, `reader.md`, `reviewer.md`, `runner.md`, `scout.md` and `web-researcher.md` and nothing else

#### Scenario: no reference to a removed agent

- **WHEN** `git grep -nE "bdk:(implementer|fixer|plan-verifier|design-verifier|code-reviewer|architecture-reviewer|test-runner|static-analyse|explorer|log-analyzer|dead-code-detector|duplicate-detector)\b"` runs over `skills/`, `agents/`, `rules/`, `hooks/`, `STARTUP_INSTRUCTIONS.md`, `README.md` and `docs/guide/`, without the migration page
- **THEN** it finds nothing, because the role names `bdk:implementer` and `bdk:design-verifier` are role skills reached through `bdk:worker` and `bdk:reader` packages, never written as `subagent_type`

#### Scenario: export stays green

- **WHEN** the v2 agents are deleted and `bdk export agents --host claude --check` runs
- **THEN** the exit code is 0, and the STARTUP agents table lists exactly the seven remaining agents
