# Spec Delta

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: No MCP names in the plugin

**Reason**: Replaced by "Plugin names no removed MCP server", which keeps the repository-search check and drops the permanent unit-test guard (design D-5). OpenSpec cannot drop a scenario through MODIFIED, so the requirement is replaced under a new name.

**Migration**: None. `tests/unit/test_no_mcp_names.py` is deleted; the acceptance `git grep` stays.


### Requirement: One built-in-tools tier

**Reason**: With one tool set left, the tier text only repeated guidance the host's system prompt already gives. It cost context in every session and every subagent spawn, and it kept `inject.py --chain`, `render_startup.py` and five meta-skills alive.

**Migration**: None needed for users. Agents and skills say what to find, and the model picks the host tool. Project-level skills that called `inject.py --chain` get a `[bdk-inject-error]` line and should drop the call.
