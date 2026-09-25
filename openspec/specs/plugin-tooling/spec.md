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

### Requirement: Removed feature keys warn

The SessionStart configuration check SHALL report a `features` key that the settings schema does not declare as a warning line in the session context, and SHALL NOT block the session for it.

#### Scenario: project still sets a removed key

- **WHEN** `.bdk/settings.json` sets `features.serena` or `features.code-review-graph` (to `true` or `false`) and is otherwise valid
- **THEN** the check exits 0 without a `decision: block`, prints the settings summary, and adds one warning line that names the key as unknown to BDK and tells the user to remove it

#### Scenario: known keys stay silent

- **WHEN** `.bdk/settings.json` sets only `features` keys the schema declares
- **THEN** the check prints no unknown-key warning

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

- **WHEN** the SessionStart hooks run in a project with or without `.bdk/settings.json`
- **THEN** the STARTUP hook's stdout is byte-identical to `STARTUP_INSTRUCTIONS.md`

#### Scenario: a stale chain call is visible

- **WHEN** a skill body runs `inject.py --chain <file>`
- **THEN** the command prints a line starting with `[bdk-inject-error]` on stdout and exits 0, so the rendered skill shows the error instead of an empty block

### Requirement: Plugin names no removed MCP server

No file of the plugin outside its historic records SHALL name the removed servers, their tools or `uvx`. Historic records are `docs/v3/`, `docs/adr/`, `openspec/`, `tests/evals/**/iterations/`, `docs/V3-IMPLEMENTATION-PLAN.md` and `docs/V3-SKILL-INVENTORY.md`.

#### Scenario: repository search

- **WHEN** `git grep -E "mcp__plugin_bdk|code-review-graph|serena|uvx"` runs over the tree with the historic records excluded
- **THEN** it finds no match
