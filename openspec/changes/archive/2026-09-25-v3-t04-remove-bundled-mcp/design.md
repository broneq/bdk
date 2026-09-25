# Design

## Context

See proposal.md - Why. The MCP wiring touches five layers: plugin wiring (`.mcp.json`, `hooks/hooks.json`, `hooks/register-graph-repo/`, `.serena/`), content injection (`fragments/tool-tiers/*.chain.json` rendered by `scripts/render_startup.py` into `STARTUP_INSTRUCTIONS.md` and by `scripts/inject.py --chain` into the five `bdk-tier-*` meta-skills plus `skills/cr` and `skills/debug`), agent and skill frontmatter and prose, settings (`features.*` in `hooks/check-bdk-config/settings.schema.json`, validated by `hooks/check-bdk-config/check.py`), and the T10 kernel CLI contract (`openspec/specs/kernel-cli/`, `schema/cli/`). The chain rules in `.claude/rules/fragment-system.md` are enforced by `tests/unit/fragments/test_tier_chain_render.py`.

Two facts shape the tier text. Agents that preload `bdk-tier-*` run with `Read`, `Grep`, `Glob` and sometimes `Bash`. The main session of recent Claude Code builds may not have `Grep` / `Glob` and uses `Bash` (`grep`, `rg`, `find`, `git`) and `Read` instead (ADR-0001, "Remove both servers"). The current fallback texts assume `Grep` / `Glob` and call themselves "Tier 3".

## Goals / Non-Goals

**Goals:**
- One tier text per purpose (search, explore, impact, edit, review), correct in both the main session and subagents.
- A tree where the acceptance grep is empty without special-casing live files.
- Keep the `features.<key>` and chain mechanisms working for the keys that stay (`caveman`, `lavish`).

**Non-Goals:**
- Rewriting the injection scripts; T13 replaces them with `bdk ctx`, and T32 deletes them.
- Improving the built-in-tools guidance beyond removing tier references and covering the main-session path; content quality of stage skills is T41.

## Decisions

### D-1 Chains stay as one-entry chains

Each `*.chain.json` keeps one unconditional entry (`{ "then": "<purpose>-fallback.md" }`, mode `exclusive`). `render_startup.py`, `inject.py --chain`, the `<!-- CHAIN: -->` markers and the `!` lines in the meta-skills and in `cr` / `debug` stay unchanged.

- Alternative: replace chains with plain fragments (markers and `!` lines point at the `.md`). Lost because it touches the renderer, seven `!` lines and the chain tests for no behaviour gain, while T13 (ADR-0001, Implementation Requirements) keeps the chain concept in `ctx skill` and T32 deletes the Python anyway.
- Alternative: delete chains and inline the text into `STARTUP_INSTRUCTIONS.md` and each meta-skill. Lost because the same text would then live in two places (orchestrator and subagent) with nothing tying them.
- The fallback files keep their names (`*-fallback.md`) so the diff stays a deletion plus a text edit; renaming them is left to T13, which rewrites the tree.

### D-2 Tier text is rewritten, not just trimmed

Each surviving fallback drops "Tier 3", "at this tier" and any sentence that compares it with a structural tier, and gains one line for the main-session path (`Bash` with `grep` / `rg` / `find` / `git`, then `Read`). The rules that carried value stay (scope every search to a path, text search is the absence check, one synonym retry, sample before reading whole files).

- Alternative: keep the texts as they are. Lost because "Tier 3" and "no community map at this tier" point at tools that no longer exist, which is the drift ADR-0001 names as a consequence to remove.

### D-3 Unknown `features` keys warn generically

`check.py` reads the declared `features` properties from `settings.schema.json` and adds one warning line per undeclared key to the session context; it never blocks for them. The removed keys are not named in code.

- Alternative: a hard-coded list of removed keys with a tailored message. Lost because it names `serena` and `code-review-graph` in live code, breaking the acceptance grep, and covers only these two keys, while T13's `config check` treats every unknown key the same way (`policy/unknown-config-key`).
- Alternative: keep the keys in the schema marked `deprecated`. Lost for the same grep reason, and because it keeps configuration for software the plugin no longer ships.
- Editors that validate `.bdk/settings.json` against the published `$schema` will flag the removed keys (`additionalProperties: false`). That is a warning in the editor, not a runtime error, and matches the intent.

### D-4 The MCP-name test is generic

The new unit test rejects any `mcp__plugin_<plugin>_<server>__<tool>` name in shipped agent, skill, fragment, rule and hook files, not only `mcp__plugin_bdk_`. It replaces the retired `.claude/rules/mcp-tool-naming.md` enforcement note and keeps its own source free of the literal the acceptance grep looks for.

- Alternative: test for the literal `mcp__plugin_bdk_`. Lost because the test file itself would then fail the acceptance grep.

### D-5 The kernel contract changes with the plugin

The T10 contract says `bdk doctor` checks `uv` / `uvx` and graph registration and `bdk hooks session-start` registers a graph. ADR-0001 assigns the implementation to T11 and T13, but the contract text and its example (`schema/cli/output/doctor.json`, the `uv-missing` finding) live in the tree now and fail the acceptance grep. T04 writes deltas against `kernel-cli/service` and `kernel-cli/hooks` and edits `schema/cli/` in the same PR, as the project's spec rule requires; `tests/contract/` keeps the pair consistent.

- Alternative: leave the contract to T11 / T13. Lost because the acceptance signal would fail and the contract would contradict an accepted ADR for weeks.

### D-6 Resolutions of "To resolve in the spec"

The user confirmed D-1 to D-7 as written in a review session on 2026-09-25.

- **Where it lands**: `staging/v3`, through the usual PR. A backport to `main` as a v2.x release follows as a separate PR from `main` after this change merges (a `feat!` or `fix` commit lets release-please cut the version), because `main` (2.6.1) and `staging/v3` have diverged. User decision, 2026-09-25.
- **One-entry chains or plain fragments**: one-entry chains (D-1).
- **The repository's own `CLAUDE.md` code-review-graph section**: removed. The acceptance grep covers `CLAUDE.md`, the measured value for the dev workflow is the same as for users, and `.claude/settings.json`'s `uvx code-review-graph` hooks go with it. A contributor who wants the graph configures it at user level.
- **`tests/evals/` iterations**: left as written; they are historic output and excluded from the grep. No eval definition outside `iterations/` names MCP tools.
- **Exclusions of the acceptance grep**: the plan's list plus `docs/V3-IMPLEMENTATION-PLAN.md` (it describes T03 and T04 themselves) and `docs/V3-SKILL-INVENTORY.md` (the T02 inventory records the v2 `tools:` lists as found). Both are records of the decision, not live content.

### D-7 Branches and issue #38

`fix/stop-hook-graph-update` was merged into `main` as #69 and its branch is gone. `fix/38-serena-activation-docs` was merged into `improvements-pack` as #42; this change removes the `setup` paragraph that issue #38 is about, so the remote branch is deleted and #38 is closed with a pointer to the T04 PR. Deleting the branch is confirmed with the user at that step.

## Risks / Trade-offs

- [A user relied on `semantic_search_nodes` or serena symbol tools] → ADR-0001 accepted this; the README says how to install either server at user level.
- [The next `main` -> `staging/v3` merge conflicts in `hooks/hooks.json`] → `main` removed only the `Stop` line; the resolution is this change's version of the file. Recorded in the PR description.
- [Agents lose tools mid-work if a session loaded the old plugin] → plugin reload at next session start; no persistent state depends on the servers except `.code-review-graph/` databases, which are git-ignored and can be deleted by the user.
- [Removing `.gitignore`'s `.code-review-graph/` line makes stale local graph databases show as untracked] → keep the tree clean by deleting the local `.code-review-graph/` directory in the BDK checkout during the task; user projects never had the ignore line from BDK.
- [Tier text gets worse for subagents] → D-2 keeps every rule the fallbacks carried; only references to missing tools go.

## Migration Plan

Users: update the plugin; nothing to do. A `.bdk/settings.json` with the removed keys shows one warning line until the keys are removed. Rollback is a plugin downgrade; no data is migrated.

