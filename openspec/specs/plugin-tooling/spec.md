# plugin-tooling Specification

## Purpose
Defines which tools the shipped BDK plugin relies on: built-in host tools only, with no bundled MCP server, no `uvx` process and one tool-tier text for every project (ADR-0001).

## Requirements

### Requirement: No bundled MCP server

The plugin SHALL NOT declare an MCP server, and none of its hooks SHALL start a `uvx` process.

#### Scenario: session start with the plugin

- **WHEN** a Claude Code session starts with `--plugin-dir` pointing at the plugin
- **THEN** the session lists no MCP server contributed by BDK, and no `uvx` process is started by any BDK hook during the session start or at `Stop`

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `.mcp.json`, no `.serena/` directory and no `hooks/register-graph-repo/` hook

### Requirement: No MCP names in the plugin

No file of the plugin outside its historic records SHALL name the removed servers, their tools or `uvx`. Historic records are `docs/v3/`, `docs/adr/`, `openspec/`, `tests/evals/**/iterations/`, `docs/V3-IMPLEMENTATION-PLAN.md` and `docs/V3-SKILL-INVENTORY.md`.

#### Scenario: repository search

- **WHEN** `git grep -E "mcp__plugin_bdk|code-review-graph|serena|uvx"` runs over the tree with the historic records excluded
- **THEN** it finds no match

#### Scenario: plugin-namespaced tool names are rejected by a test

- **WHEN** an agent `tools:` list, a skill `allowed-tools` entry, or the body of a shipped agent, skill, fragment, rule or hook names a plugin-namespaced MCP tool (`mcp__plugin_<plugin>_<server>__<tool>`)
- **THEN** the unit test suite fails and names the file and the tool

### Requirement: One built-in-tools tier

Every tool-tier text the plugin renders SHALL name only built-in host tools (`Read`, `Grep`, `Glob`, `Bash`) and SHALL be the same whatever `features` the project sets.

#### Scenario: tier text independent of features

- **WHEN** `STARTUP_INSTRUCTIONS.md` is rendered and each `bdk-tier-*` meta-skill (`search`, `explore`, `impact`, `edit`, `review`) is resolved, once with no `features` and once with every declared `features` key plus an undeclared one (such as `features.serena`) set to `true`
- **THEN** each of the two renderings produces the same text, that text is non-empty for every tier, and it names no MCP tool

#### Scenario: tier text without project settings

- **WHEN** the project has no `.bdk/settings.json` and `STARTUP_INSTRUCTIONS.md` is rendered or a `bdk-tier-*` meta-skill is resolved
- **THEN** each tier shows the same built-in-tools text as with settings, not an empty section

#### Scenario: tier text serves both the main session and subagents

- **WHEN** a tier text is read
- **THEN** it names the subagent tools (`Grep`, `Glob`, `Read`) and the main-session path (`Bash` with `grep`, `rg`, `find` or `git`, and `Read`), and it does not describe itself as one tier among several

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
