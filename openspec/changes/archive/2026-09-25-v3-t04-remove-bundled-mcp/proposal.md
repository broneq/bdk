# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T04. Tracks #75.

ADR-0001 (`docs/adr/0001-remove-bundled-mcp-servers.md`) decided to remove both bundled MCP servers, serena and code-review-graph: neither passed the T03 value rule (D-7), and both cost start-up time, memory and connect timeouts in every session. The plugin still ships them, so every session pays that cost while v3 is built, and every v3 task that touches tiers, agents or hooks would start from a tree full of MCP wiring it has to route around. T04 carries the decision out now, before T11, T13, T41 and T42 build on the result.

## What Changes

- **BREAKING** (for users who relied on the bundled servers): the plugin ships no MCP server. `.mcp.json` is deleted; the `uvx` presence warning, the `uvx code-review-graph status` SessionStart line, the `Stop` `uvx code-review-graph update` line and the `hooks/register-graph-repo/` hook go; `.serena/` goes. Users who want the servers install them at user level (ADR-0001, Consequences).
- Tool tiers collapse to the built-in-tools text. The `*-graph.md` and `*-serena.md` tier fragments and `fragments/code-review-graph/` go. Each of the five `fragments/tool-tiers/*.chain.json` keeps one unconditional entry, the former fallback, rewritten so it no longer calls itself "Tier 3" or refers to higher tiers, and so it names both the subagent tools (`Grep`, `Glob`, `Read`) and the main-session path (`Bash` with `grep` / `rg` / `find` / `git`, and `Read`). `STARTUP_INSTRUCTIONS.md` and the five `bdk-tier-*` meta-skills render that text whatever `features` says.
- Agents and skills: every `mcp__plugin_bdk_*` entry leaves agent `tools:` and skill `allowed-tools`; agent and skill prose that names MCP tools or tiers (`explorer`, `code-reviewer`, `setup`, `explain-complex-code`, `update-docs`, `create-plan`, `cr`, `debug` and the others the inventory finds) is rewritten for `Read` / `Grep` / `Glob` / `Bash`. `skills/setup` stops writing `features.serena` / `features.code-review-graph` and no longer builds the graph or documents a Serena activation hook (also resolves issue #38).
- Settings: `features.serena` and `features.code-review-graph` leave `hooks/check-bdk-config/settings.schema.json` and the examples in `scripts/get_settings.py` and `scripts/inject.py`. The SessionStart config check warns, without blocking, on any `features` key the schema does not declare, which covers projects that still set the two removed keys.
- Kernel CLI contract (T10 main specs): `bdk doctor` no longer checks `uv` / `uvx` or graph registration, and `bdk hooks session-start` no longer registers a graph or reports a missing `uvx`; `schema/cli/` changes with the specs (ADR-0001, Implementation Requirements for T11 and T13).
- Tests: tests for removed parts go (`test_register.py`, `test_tier_graph_menus.py`, `test_tier_graph_fragments.py`, the graph and serena cases in `test_agent_tools.py`, `test_inject.py`, `test_render_startup.py`, `test_tier_chain_render.py`, `test_get_settings.py`); a new test fails on any `mcp__plugin_bdk_` name in the shipped plugin, and the tier test asserts the same text with features on and off.
- Docs and dev config: `README.md`, `CONTRIBUTING.md`, `IDEAS.md`, `docs/INJECTION-FLOWS.md`, `.gitignore`, `.claude/settings.json` (its `uvx code-review-graph` hooks), the repository's own `CLAUDE.md` code-review-graph section; `.claude/rules/mcp-tool-naming.md` is retired and the MCP parts of `.claude/rules/fragment-system.md`, `.claude/rules/inject-fragments.md` and `.claude/rules/skill-creation-rules.md` are rewritten.
- Branches: `fix/stop-hook-graph-update` already merged into `main` as #69 (v2.6.1) and is deleted, so nothing is left to close. `fix/38-serena-activation-docs` was merged into `improvements-pack` as #42; its remote branch is deleted and issue #38 is closed as resolved by this change.

Inputs carried by citation: ADR-0001 (decision, Consequences, Implementation Requirements); T03 Resolution in the plan; `.claude/rules/fragment-system.md` (chain rules the reduced chains still satisfy); T02 decision R-7 (`scout` tools are `Read`, `Grep`, `Glob`, `Bash`); the T10 kernel CLI contract in `openspec/specs/kernel-cli/`.

Out of scope:
- Implementing `bdk doctor` (T11) and `bdk hooks session-start` (T13, T24); T04 only changes their contract text.
- `uv.lock`, `pyproject.toml` and the CI `setup-uv` step: they serve pytest, not MCP, and go with the Python cut (T32).
- The `features` import report for v2 -> v3 (T32) and the `config check` unknown-key rule in the kernel (T12, T13).
- The `scout` adapter and the other v3 adapters (T42); the stage-skill content test (T41).
- Historic eval output in `tests/evals/**/iterations/`, left as written.

## Capabilities

### New Capabilities

- `plugin-tooling`: which tools the shipped plugin relies on: no bundled MCP server, no `uvx` process, no `mcp__plugin_bdk_` tool name, one built-in-tools tier text independent of `features`, and a warning (not a block) for `features` keys the settings schema does not declare.

### Modified Capabilities

- `kernel-cli/service`: `bdk doctor` drops the `uv` / `uvx` presence check, the graph-registration check and the `uv-missing` finding in its example.
- `kernel-cli/hooks`: `bdk hooks session-start` drops graph registration, the note on plain-shell `uvx` lines and the missing-`uvx` line in the Hook payloads table.

## Impact

- Plugin wiring: `.mcp.json`, `hooks/hooks.json`, `hooks/register-graph-repo/`, `hooks/check-bdk-config/`, `.serena/`.
- Content: `fragments/tool-tiers/`, `fragments/code-review-graph/`, `STARTUP_INSTRUCTIONS.md`, `skills/bdk-tier-*`, 10 agent files, about 12 skills.
- Scripts: `scripts/inject.py` and `scripts/get_settings.py` (docstrings only; the `features.<key>` mechanism stays for `caveman` and `lavish`).
- Contract: `openspec/specs/kernel-cli/{service,hooks}/spec.md`, `schema/cli/commands.json`, `schema/cli/output/doctor.json`, `schema/cli/output/hooks-session-start.json`.
- Users: sessions start without the two servers and without `uvx`; a `.bdk/settings.json` with the removed keys keeps working and shows a warning line; the `$schema` in such a file flags the keys in the editor.
- Branch sync: `main` (2.6.1) already removed the `Stop` graph update in `hooks/hooks.json`; the next merge of `main` into `staging/v3` touches the same lines and resolves to this change's version.
