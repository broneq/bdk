# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T04. Tracks #75.

`v3-t04-remove-bundled-mcp` kept the tool-tier layer as five one-entry chains (its design D-1). The only reason to keep it was a tier that might come later. Once the MCP servers were gone, the layer lost the one thing it did: pick a tool set per project. What is left costs context and gives nothing back:

- Each chain renders one unconditional text, so `mode`, `if` and `prefer` no longer do anything.
- The text is general advice on `Grep`, `Glob`, `Read` and `Bash`. The host's own system prompt already gives the model this advice.
- Every session pays for it in `STARTUP_INSTRUCTIONS.md`. Every subagent spawn pays for it again through `bdk-tier-*` preloads. Skill bodies inject it a third time.
- It keeps three pieces of machinery alive: `inject.py --chain`, `render_startup.py` and five meta-skills. T13 would then have to port the same machinery into `bdk ctx`.

The T04 scope already lists this outcome: "each chain keeps only its built-in-tools tier (or the chains collapse to plain fragments)". The plan's "To resolve in the spec" asked whether the tier chains should stay chains. This change answers no, reverses `v3-t04-remove-bundled-mcp` D-1, and lands in the same PR (#76) before T04 merges.

## What Changes

- **Tool tiers go.** This removes `fragments/tool-tiers/` (5 chains, 5 fragments) and the five `bdk-tier-*` meta-skills. It also removes every `bdk-tier-*` entry from agent `skills:` frontmatter, and the `skills:` key from agents that have no other preload.
- **Skill injection sites go.** The `inject.py --chain` lines leave `cr`, `debug` (2), `design`, `explain-complex-code`, `refine-rules`, `test-driven-development` and `update-docs`. Prose that pointed at "the tools above" is rewritten as a plain instruction.
- **Chain mechanism goes.** `inject.py` loses `--chain` and `inject_chain`. `--if`, `--prefer`, `--then` and `--then-text` stay. Argument errors print `[bdk-inject-error]` on stdout and exit 0, like every other `inject.py` failure, so a stale `--chain` call is visible instead of rendering empty.
- **STARTUP becomes static.** `scripts/render_startup.py` is deleted. The SessionStart hook prints `STARTUP_INSTRUCTIONS.md` as is. Its `## Tool Guidance` section and the `<!-- CHAIN -->` markers go.
- **Agent and skill text.** Agents drop "Follow the tool-tier ... guidance". Skill headers drop "and tool guidance". `create-plan`'s explorer prompt drops its reference to preloaded tool guidance. Skill and agent steps stop naming tools (`Grep`, `Glob`, `Read`, `Bash`) and say only what to find or check; the model already knows its tools.
- **Specs.** In `plugin-tooling`, "One built-in-tools tier" is replaced by "No tool-tier layer".
- **Kernel contract.** `bdk ctx` drops the `tier` part kind and tier chains from `skill`, `role` and `startup`. The `ctx` slice description in `kernel-architecture` drops "tiers". `schema/cli/` changes with the specs. In the plan, the T13 scope no longer asks `ctx skill` to implement chains.
- **Tests.** `test_tier_chain_render.py`, `test_render_startup.py` and the chain cases in `test_inject.py` are deleted. A temporary absence guard drives the removal and is deleted at the end, together with `test_no_mcp_names.py` from the MCP removal. Absence guards do not stay in the suite (design D-5).
- **Docs and rules.**
  - `.claude/rules/script-tests.md` gains one line: absence guards are removal scaffolding and get deleted.
  - `.claude/rules/fragment-system.md` drops chains and keeps the fragment and agent-preload parts.
  - `.claude/rules/inject-fragments.md` and `.claude/rules/skill-creation-rules.md` drop their chain parts.
  - `.claude/rules/portability-check.md` drops `bdk-tier-*` from its exempt list.
  - `CONTRIBUTING.md` "Writing Fragments" drops chain files.
  - `docs/INJECTION-FLOWS.md` gets an update note.

Inputs carried by citation:
- ADR-0001;
- `v3-t04-remove-bundled-mcp` (archived), design D-1 (reversed here) and D-2;
- `.claude/rules/fragment-system.md`;
- T02 decision Q-3 (roles are skills under `skills/roles/`, so no class-level preload remains to carry tiers);
- the T10 contract in `openspec/specs/kernel-cli/`.

Out of scope:
- Implementing `bdk ctx` (T13) and `bdk hooks session-start` (T13, T24). This change only edits their contract text.
- Replacing the `bdk-rules-*`, `bdk-lint-tools` and `bdk-test-tools` preloads with role skills (T42).
- `docs/V3-SKILL-INVENTORY.md` and the plan's T02 section. Both are records of a finished task and stay as written.
- `inject.py --prefer`. It is a general inline flag, not part of the tier layer, and it goes with the Python cut (T32).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-tooling`: "One built-in-tools tier" is removed. "No tool-tier layer" is added. "No MCP names in the plugin" is replaced by "Plugin names no removed MCP server", the same check without the unit-test scenario.
- `kernel-cli/ctx`: `bdk ctx skill`, `bdk ctx role` and `bdk ctx startup` compose no tool tiers and no chains, and their examples carry no `tier` part.
- `kernel-architecture`: the `ctx` row of the slice list no longer names tiers.

## Impact

- **Plugin:** `fragments/tool-tiers/`, `skills/bdk-tier-*/`, 10 agents, 8 skills, `scripts/inject.py`, `scripts/render_startup.py`, `hooks/hooks.json`, `STARTUP_INSTRUCTIONS.md`, `skills/create-plan/references/explorer-prompts.md`.
- **Tests:** `tests/unit/fragments/test_tier_chain_render.py`, `tests/unit/scripts/test_render_startup.py`, `tests/unit/scripts/test_inject.py`, `tests/unit/test_no_mcp_names.py` (deleted), and a temporary guard `tests/unit/test_no_tool_tiers.py` that is deleted before the change ends.
- **Contract:** `openspec/specs/kernel-cli/ctx/spec.md`, `openspec/specs/kernel-architecture/spec.md`, `schema/cli/commands.json`, `schema/cli/output/ctx.json`.
- **Docs:** `.claude/rules/`, `CONTRIBUTING.md`, `docs/INJECTION-FLOWS.md`, `docs/V3-IMPLEMENTATION-PLAN.md` (T13 scope only), `openspec/specs/plugin-tooling/spec.md` Purpose line.
- **Users:**
  - Sessions and subagents get shorter context.
  - Nobody has to change a setting.
  - A project-level skill that still calls `inject.py --chain` gets a `[bdk-inject-error]` line on stdout. Today argparse errors go to stderr with exit 2, which a `!` block renders as nothing (design D-3). No BDK-shipped file makes that call.
