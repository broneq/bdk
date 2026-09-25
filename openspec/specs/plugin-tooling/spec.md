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

### Requirement: Unit suite green after the removal

The unit test suite SHALL pass on the plugin without the MCP servers, with tests for removed parts deleted and tests that assert tier or tool content updated.

#### Scenario: the unit suite passes

- **WHEN** `pytest tests/unit/` runs on the result
- **THEN** every test passes

### Requirement: No tool-tier layer

The plugin SHALL NOT ship a tool-guidance layer on top of the host's built-in tools. There are no tool-tier chain files or fragments, no `bdk-tier-*` meta-skills, no agent preload of a tier skill, no chain markers in `STARTUP_INSTRUCTIONS.md`, and no `--chain` mode in `scripts/inject.py`. The SessionStart hook SHALL print `STARTUP_INSTRUCTIONS.md` unchanged.

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `fragments/tool-tiers/` directory, no `skills/bdk-tier-*` skill, no `*.chain.json` file and no `scripts/render_startup.py`

#### Scenario: no reference to the tier layer

- **WHEN** a shipped agent, skill, fragment, rule, hook, script or `STARTUP_INSTRUCTIONS.md` is scanned
- **THEN** no agent `skills:` list names a `bdk-tier-*` skill, and no file calls `inject.py --chain` or holds a `<!-- CHAIN: ... -->` marker

#### Scenario: STARTUP is served verbatim

- **WHEN** the SessionStart hooks run in a project with or without `.bdk/settings.yaml`
- **THEN** the STARTUP hook's stdout is byte-identical to `STARTUP_INSTRUCTIONS.md`

#### Scenario: a stale chain call is visible

- **WHEN** a skill body runs `inject.py --chain <file>`
- **THEN** the command prints a line starting with `[bdk-inject-error]` on stdout and exits 0, so the rendered skill shows the error instead of an empty block

### Requirement: Plugin names no removed MCP server

No file of the plugin outside its historic records SHALL name the removed servers, their tools or `uvx`. Historic records are `docs/v3/`, `docs/adr/`, `openspec/`, `tests/evals/**/iterations/`, `docs/V3-IMPLEMENTATION-PLAN.md` and `docs/V3-SKILL-INVENTORY.md`.

#### Scenario: repository search

- **WHEN** `git grep -E "mcp__plugin_bdk|code-review-graph|serena|uvx"` runs over the tree with the historic records excluded
- **THEN** it finds no match

### Requirement: Settings read through the kernel

Every settings read of the plugin SHALL go through the kernel's `bdk config`, and the plugin SHALL NOT read or ship `.bdk/settings.json` readers or a hand-written settings schema.

A skill that injects a tool list calls `bdk config show tools.<kind>` in a `!` block of the form `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config show tools.<kind> 2>&1 || echo "BDK STOP: ..."`, and pre-approves it with `allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)`: the rule quotes the path as the block does, and the echo rule covers the fallback, whose `$?` Claude Code does not pre-approve otherwise (`kernel-cli`, Output modes). These blocks are transitional: T13 replaces them with `ctx skill` and the content check of `kernel-cli` then applies. The injection scripts `inject.py`, `inject-rules.py` and `inject-language-rules.py` take feature flags, languages and rule overrides from `bdk config show --json` until T13 deletes them. `setup` writes `.bdk/settings.yaml` with the modeline (`kernel-settings`, Settings JSON Schema).

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `scripts/get_settings.py` and no `hooks/check-bdk-config/` directory

#### Scenario: no reader of the v2 file

- **WHEN** `git grep -n "settings.json"` runs over `skills/`, `agents/`, `scripts/` and `hooks/`
- **THEN** it finds no code that opens `.bdk/settings.json`; prose that names it only as the v2 file converted by `bdk import` is allowed

#### Scenario: tool list in a skill

- **WHEN** a project's `.bdk/settings.yaml` declares a `tools.test` item and a skill with the `bdk config show tools.test` block loads
- **THEN** the rendered skill holds that item as YAML, including its `when` text

#### Scenario: rule override through a prompt value

- **WHEN** `.bdk/prompts/rules/security.md` has `mode: replace` and a skill runs `inject-rules.py security`
- **THEN** the script prints that file's content instead of the plugin's `rules/security.md`

### Requirement: Settings check at session start

The SessionStart hooks SHALL run `bdk config check` and show its result in the session context without blocking the session.

The hook command is `test -d .bdk && node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config check 2>&1 || true`, so a session outside a BDK project prints nothing. A refusal (an unknown or removed key, an invalid value) and the warnings reach the context as text, and the hook exits 0 in every case. A removed v2 key is named with its replacement or reason (`kernel-settings`, Removed v2 keys). `hooks session-start` (T13) replaces this hook entry.

#### Scenario: project still sets a removed key

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true` and a session starts
- **THEN** the hook exits 0, no `decision: block` is emitted, and the session context holds the refusal naming `features.serena`

#### Scenario: known keys stay silent

- **WHEN** `.bdk/settings.yaml` sets only registered keys, carries the modeline and no `.bdk/settings.json` exists
- **THEN** the hook prints no problem line

#### Scenario: not a BDK project

- **WHEN** a session starts in a directory without `.bdk/`
- **THEN** the hook prints nothing and exits 0
