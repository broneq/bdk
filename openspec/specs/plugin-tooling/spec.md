# plugin-tooling Specification

## Purpose

Defines which tools the shipped BDK plugin relies on: built-in host tools only, with no bundled MCP server, no `uvx` process and no tool-guidance layer (ADR-0001).

## Requirements

### Requirement: No bundled MCP server

The plugin SHALL NOT declare an MCP server, and none of its hooks SHALL start a `uvx` process.

#### Scenario: session start with the plugin

- **WHEN** a Claude Code session starts with `--plugin-dir` pointing at the plugin
- **THEN** the session lists no MCP server contributed by BDK, and no `uvx` process is started by any BDK hook during the session start or at `Stop`

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `.mcp.json`, no `.serena/` directory and no `hooks/register-graph-repo/` hook

### Requirement: No tool-tier layer

The plugin SHALL NOT ship a tool-guidance layer on top of the host's built-in tools. There are no tool-tier chain files or fragments, no `bdk-tier-*` meta-skills, no agent preload of a tier skill, and no chain markers in `STARTUP_INSTRUCTIONS.md`. The context a skill receives does not depend on a removed tier switch (`features.code-review-graph`, `features.serena`).

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `fragments/tool-tiers/` directory, no `skills/bdk-tier-*` skill, no `*.chain.json` file and no `scripts/render_startup.py`

#### Scenario: no reference to the tier layer

- **WHEN** a shipped agent, skill, fragment, rule, hook, script or `STARTUP_INSTRUCTIONS.md` is scanned
- **THEN** no agent `skills:` list names a `bdk-tier-*` skill, and no file holds a `<!-- CHAIN: ... -->` marker

#### Scenario: STARTUP is served verbatim

- **WHEN** the SessionStart hook runs in a project with or without `.bdk/settings.yaml`
- **THEN** its stdout starts with text byte-identical to `STARTUP_INSTRUCTIONS.md`, which is itself byte-identical to `bdk ctx startup`

#### Scenario: a stale chain call is visible

- **WHEN** a skill body carries a `!` line that runs `inject.py`, with or without `--chain`
- **THEN** `pnpm skill-check` reports a wrapper form error and the skill context content test fails

#### Scenario: same context with or without a removed tier key

- **WHEN** `bdk ctx skill design` runs with and without `features.code-review-graph: true` in `.bdk/settings.yaml`
- **THEN** both outputs are byte-identical

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

### Requirement: Settings read through the kernel

Every settings read of the plugin SHALL go through the kernel, and the plugin SHALL NOT read or ship `.bdk/settings.json` readers, a hand-written settings schema or a Python bridge to the kernel.

A skill receives settings-derived content (rule sets, language rules, fragments, tool entries) only through `bdk ctx skill <name>` in its context lines (`kernel-cli`, Output modes). `setup` runs `bdk config` commands directly. `setup` writes `.bdk/settings.yaml` with the modeline (`kernel-settings`, Settings JSON Schema).

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `scripts/get_settings.py`, `scripts/kernel_settings.py`, `scripts/inject.py`, `scripts/inject-rules.py`, `scripts/inject-language-rules.py`, and no `hooks/check-bdk-config/`, `hooks/is-skill-exist/` or `hooks/check-rules-drift/` directory

#### Scenario: no reader of the v2 file

- **WHEN** `git grep -n "settings.json"` runs over `skills/`, `agents/`, `scripts/` and `hooks/`
- **THEN** it finds no code that opens `.bdk/settings.json`; prose that names it only as the v2 file migrated by `/bdk:setup` is allowed

#### Scenario: tool list in a skill

- **WHEN** a project's `.bdk/settings.yaml` declares a `tools.test` item and the skill `debug` loads
- **THEN** the rendered skill holds that item, including its `when` text, in the `Project commands: test` section of its BDK context

#### Scenario: rule override through a prompt value

- **WHEN** `.bdk/prompts/rules/security.md` has `mode: replace` and a skill whose manifest entry lists `rules/security` loads
- **THEN** its `Rules: security` section holds that file's content instead of the plugin's `rules/security.md`

### Requirement: Settings check at session start

The SessionStart hook SHALL run `bdk hooks session-start`, which prints STARTUP and, in a BDK project, the configuration check and v2 layout detection as content, without blocking the session.

`hooks/hooks.json` has exactly one SessionStart command, `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`, and no Stop hook (T02 decision Q-6: the rule-drift check is not ported). No hook command in `hooks/hooks.json` or in skill frontmatter runs `python3`. The output shapes are in `kernel-cli/hooks`, `bdk hooks session-start`.

#### Scenario: project still sets a removed key

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true` and a session starts
- **THEN** the hook exits 0, no `decision: block` is emitted, and the session context holds the STARTUP text followed by a `[BDK] config:` line naming `features.serena`

#### Scenario: known keys stay silent

- **WHEN** `.bdk/settings.yaml` sets only registered keys, carries the modeline and no v2 marker exists
- **THEN** the hook prints the STARTUP text and no problem line

#### Scenario: not a BDK project

- **WHEN** a session starts in a directory without `.bdk/`
- **THEN** the hook prints the STARTUP text only and exits 0

#### Scenario: hooks file

- **WHEN** `hooks/hooks.json` is inspected
- **THEN** it has one `SessionStart` command matching the shape above, no `Stop` entry, and no command containing `python3`

#### Scenario: kernel unavailable at session start

- **WHEN** a session starts on a machine without `node` on `PATH`
- **THEN** the hook exits 0 and the session context ends with the `BDK STOP: kernel unavailable` line

### Requirement: Skill context lines

Every skill that needs prompt context SHALL receive it through exactly one pair of context lines (`kernel-cli`, Output modes, Context lines of a skill). A content test SHALL enforce the pair, so that a later change of the line form is made in one spec block and every skill that no longer matches fails.

The test (in the kernel's contract suite) reads every `skills/*/SKILL.md` and checks:

- a skill whose body mentions `ctx skill` has, as its first two non-empty body lines, a line matching the `content-wrapper` regex and a line matching the `content-fallback` regex, both naming the skill's directory name;
- no other line of the skill calls the kernel through a `!` block, and no line runs `inject.py`, `inject-rules.py`, `inject-language-rules.py` or `cat` in a `!` block;
- the set of skills with context lines equals the set of entries in the `ctx skill` manifest, and every part of every entry resolves (a declared prompt key with a plugin default, a `tools` group, an existing plugin file).

The regexes are read from the `kernel-cli` spec, not copied into the test. `skill-check` keeps enforcing the wrapper form and the `allowed-tools` pair (`skill-content-checks`).

#### Scenario: a skill without the fallback sentence

- **WHEN** a skill carries the wrapper line for `ctx skill debug` but not the fallback sentence
- **THEN** the content test fails and names the skill and the missing line

#### Scenario: a line names another skill

- **WHEN** `skills/design/SKILL.md` carries the context lines for `ctx skill create-plan`
- **THEN** the content test fails and names both skills

#### Scenario: manifest and skills disagree

- **WHEN** the manifest has an entry for a skill whose `SKILL.md` has no context lines, or a skill has context lines and no manifest entry
- **THEN** the content test fails and names the skill

#### Scenario: form change is found everywhere

- **WHEN** the `content-fallback` regex in `kernel-cli` changes and the skills are not updated
- **THEN** the content test fails once for every skill with context lines

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

### Requirement: Repository without Python

The plugin and its repository SHALL hold no Python (design "Migration (Q1)", Q1). No file under `hooks/` or `skills/` SHALL run `python3`. Git SHALL track no `.py` file, no `__pycache__` directory, no `pyproject.toml` and no `uv.lock`, and no `package.json` script SHALL run `uv`, `uvx`, `pytest` or `ruff`. Historic records (`docs/v3/`, `docs/adr/`, `openspec/changes/archive/`, `tests/fixtures/`) MAY name Python as recorded text.

#### Scenario: python3 in the plugin

- **WHEN** `grep -r python3 hooks/ skills/` runs on the tree
- **THEN** it prints nothing

#### Scenario: tracked Python files

- **WHEN** `git ls-files` is filtered for `\.py$`, `__pycache__`, `pyproject.toml` and `uv.lock`
- **THEN** the result is empty

#### Scenario: scripts without a Python tool

- **WHEN** the `scripts` of `package.json` are read
- **THEN** no script runs `uv`, `uvx`, `pytest` or `ruff`

### Requirement: Ported repository guards

Two repository guards SHALL run as vitest tests in the `contract` project (D5, consequences: porting tests):

1. The host probe collector `tests/host-probe/collect.mjs` replaces the home directory, the project path and its encoded forms, the plugin root, the per-user Claude temp directory, the git identity and e-mail addresses with placeholders. It maps session and agent ids to stable placeholders, keeps keys, types and nesting, adds the probe metadata, and fails with the name of the check when a recording is missing.
2. A leak guard reads every JSON file under `tests/fixtures/host-payloads/` and fails on machine data: a home directory prefix, plain (`/Users/`, `/home/`) or dash-encoded (`-Users-`, `-home-`), an e-mail address, or the running user's name as a standalone token. The name inside another word (`runners`, `bdk:test-runner`) is not a finding, and neither is a name that is also a BDK role or adapter name (`runner`, the GitHub runner's user).

`agents/web-researcher.md` SHALL keep exactly the tools `WebSearch`, `WebFetch`, `Read`, `Grep` and `Glob`. A change to that set fails the plugin layout contract test until the test changes with it.

#### Scenario: a recording leaks the home directory

- **WHEN** a file under `tests/fixtures/host-payloads/` holds a path that starts with `/Users/`
- **THEN** `pnpm test:contract` fails and names the file and the match

#### Scenario: collector anonymises a payload

- **WHEN** the collector runs on a recording whose payloads hold the home directory, the project path in its encoded form and a session id
- **THEN** its output holds the placeholders instead, the same id maps to the same placeholder everywhere, and the payload keys and nesting are unchanged

#### Scenario: web-researcher gains a tool

- **WHEN** `Bash` is added to the `tools:` of `agents/web-researcher.md`
- **THEN** `pnpm test:contract` fails and names the added tool

### Requirement: Kernel test suites

The repository's tests SHALL run as the vitest projects `unit`, `e2e` and `contract`, and every test SHALL pass on the plugin as shipped. No test suite needs Python.

#### Scenario: the suites pass

- **WHEN** `pnpm test:unit`, `pnpm test:e2e` and `pnpm test:contract` run on the result
- **THEN** every test passes

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
