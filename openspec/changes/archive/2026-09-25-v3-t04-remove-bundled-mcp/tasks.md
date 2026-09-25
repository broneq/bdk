# Tasks

## 1. Start

- [x] 1.1 Set issue #75's card to "In progress" on the project board (needs the `project` token scope: `gh auth refresh -s project`); verify with `gh project item-list 1 --owner broneq --format json` that the item shows `In progress`
- [x] 1.2 Record the baseline: run `pytest tests/unit/ -q` and `node --test tests/contract/*.test.mjs` on the branch before any edit; verify both pass, or record every pre-existing failure and fix it in this change (project rule: no known red tests left behind)

## 2. Guard tests first

- [x] 2.1 Write the failing test `tests/unit/test_no_mcp_names.py` (design D-4): scan `agents/`, `skills/`, `fragments/`, `rules/`, `hooks/`, `scripts/`, `STARTUP_INSTRUCTIONS.md` for any plugin-namespaced MCP tool name (regex on `mcp__plugin_` followed by plugin, server and tool segments), and assert `.mcp.json`, `.serena/` and `hooks/register-graph-repo/` do not exist; report file and name on failure; verify it fails today and names the agent files, `skills/setup/SKILL.md`, `skills/explain-complex-code/references/examples.md` and `skills/update-docs/SKILL.md`
- [x] 2.2 Rewrite `tests/unit/fragments/test_tier_chain_render.py` to the new contract: every chain renders non-empty text, the rendered text is identical with no `features` and with `features.code-review-graph` / `features.serena` set to `true`, and it names no MCP tool; drop `test_edit_chain_contains_additive_and_impact_and_structural`, `test_impact_chain_leads_with_impact_radius`, `test_review_chain_leads_with_detect_changes` and the graph-enabled case; verify the new cases fail today because the flags change the output
- [x] 2.3 Add failing cases to `tests/unit/hooks/check-bdk-config/test_check.py` for design D-3: a `features` key missing from `settings.schema.json` (use a made-up key) produces one warning line, exit 0 and no `decision: block`; declared keys produce no warning; verify the new cases fail
- [x] 2.4 Add a failing case to `tests/unit/scripts/test_render_startup.py`: the rendered `STARTUP_INSTRUCTIONS.md` has non-empty text under each tier heading and no MCP tool name, the same with features on and off; verify it fails today

## 3. Plugin wiring

- [x] 3.1 Delete `.mcp.json`, `.serena/` and `hooks/register-graph-repo/` with `tests/unit/hooks/register-graph-repo/`; verify `git ls-files .mcp.json .serena hooks/register-graph-repo tests/unit/hooks/register-graph-repo` prints nothing
- [x] 3.2 Remove the `uvx` warning, `uvx code-review-graph status` and `register-graph-repo` entries from `SessionStart` and the `uvx code-review-graph update` entry from `Stop` in `hooks/hooks.json`; verify the file parses (`python3 -m json.tool hooks/hooks.json`) and `grep -c uvx hooks/hooks.json` is 0
- [x] 3.3 Remove the `uvx code-review-graph` hooks from `.claude/settings.json` (drop the hook blocks that become empty) and the `.code-review-graph/` lines from `.gitignore`; delete the local untracked `.code-review-graph/` directory in this checkout; verify `.claude/settings.json` parses and `git status --ignored` shows no `.code-review-graph/`

## 4. Tool tiers

- [x] 4.1 Delete `fragments/tool-tiers/*-graph.md`, `fragments/tool-tiers/*-serena.md`, `fragments/code-review-graph/`, `tests/unit/fragments/test_tier_graph_menus.py` and `tests/unit/fragments/test_tier_graph_fragments.py`; reduce each of the five `*.chain.json` to `{ "mode": "exclusive", "chain": [{ "then": "<purpose>-fallback.md" }] }` (design D-1); verify every chain parses and references an existing file
- [x] 4.2 Rewrite the five `*-fallback.md` texts per design D-2 (no "Tier 3" or tier comparisons; subagent tools plus the main-session `Bash` path; keep the scoping, absence and sampling rules); verify tests 2.2 and 2.4 pass
- [x] 4.2a Render unconditional chain entries without project settings: `inject_chain` and `inject.py --chain` treat a missing `.bdk/settings.json` as empty settings (conditional `if` entries still need settings; the `--if` / `--then` mode is unchanged); replace `test_chain_none_settings_returns_empty` in `tests/unit/scripts/test_inject.py` with a failing test that an unconditional entry renders with `settings=None` and an `if` entry does not, plus a CLI case with no settings file; verify both pass after the change and `python3 scripts/render_startup.py` in a directory without `.bdk/` shows all three tier sections
- [x] 4.3 Update `STARTUP_INSTRUCTIONS.md` prose around the markers ("best available tool tier", "injected based on your project's enabled features") to describe one built-in-tools guidance; verify `python3 scripts/render_startup.py` output reads correctly with and without `features` and test 2.4 passes
- [x] 4.4 Update `.claude/rules/fragment-system.md` (drop the tier-chain table rows and examples that name graph / serena, keep the chain format and the additive `prefer` rule with a neutral example), `.claude/rules/inject-fragments.md` and `.claude/rules/skill-creation-rules.md` MCP parts; delete `.claude/rules/mcp-tool-naming.md`; verify `git grep -nE "code-review-graph|serena|mcp__plugin_bdk" .claude/` is empty

## 5. Agents and skills

- [x] 5.1 Remove every plugin MCP tool from `tools:` in the 10 agents (`architecture-reviewer`, `code-reviewer`, `dead-code-detector`, `design-verifier`, `duplicate-detector`, `explorer`, `fixer`, `implementer`, `log-analyzer`, `plan-verifier`) and rewrite their prose (descriptions, workflows, examples) for `Read` / `Grep` / `Glob` / `Bash`; make sure each agent that needs `Bash` for `git` or `rg` has it; verify with `/bdk:agent-lint` on each changed agent
- [x] 5.2 Update `tests/unit/agents/test_agent_tools.py`: drop the graph gap-fill contract, keep the narrow-agents contract with the new tool sets; verify it passes
- [x] 5.3 Rewrite `skills/setup/SKILL.md`: `allowed-tools` without MCP, no `features.serena` / `features.code-review-graph` in the written settings, no graph build step, no Serena activation paragraph (closes the defect in issue #38); verify `/bdk:skill-lint skills/setup` passes
- [x] 5.4 Rewrite MCP references in `skills/explain-complex-code/` (SKILL.md and `references/examples.md`), `skills/update-docs/SKILL.md`, `skills/create-plan/` (SKILL.md and `references/explorer-prompts.md`), `skills/cr/` (SKILL.md and `references/review-engine.md`), `skills/debug/SKILL.md`, `skills/pr-review/SKILL.md`, `skills/create-adr/SKILL.md`, `skills/subagent-execute-plan/SKILL.md`, `skills/test-driven-development/SKILL.md`, `skills/verify-plan/SKILL.md`, `skills/refine-rules/references/rule-admission.md`; verify `git grep -niE "serena|code-review-graph|mcp__plugin_bdk|graph tier" skills/` is empty and `/bdk:skill-lint` passes on each changed skill
- [x] 5.5 Verify test 2.1 passes

## 6. Settings

- [x] 6.1 Remove `serena` and `code-review-graph` from `features` in `hooks/check-bdk-config/settings.schema.json`; implement the unknown-key warning in `hooks/check-bdk-config/check.py` reading the declared keys from the schema (design D-3); verify test 2.3 passes
- [x] 6.2 Replace the MCP examples in the docstrings of `scripts/get_settings.py` and `scripts/inject.py` with the remaining keys (`caveman`, `lavish`) or neutral ones; update `tests/unit/scripts/test_get_settings.py` and `tests/unit/scripts/test_inject.py` cases that use the removed keys to neutral keys, keeping what each case tests; verify both test files pass

## 7. Kernel CLI contract

- [x] 7.1 Apply the `kernel-cli/service` and `kernel-cli/hooks` deltas to `schema/cli/`: `commands.json` `hooks session-start` summary without "graph registration", `output/hooks-session-start.json` description likewise, `output/doctor.json` example without the `uv-missing` finding; verify `node --test tests/contract/*.test.mjs` passes with the change's delta specs (the contract test reads the main specs, so run it again after archive)

## 8. Docs

- [x] 8.1 Update `README.md` (no bundled MCP; how to install serena or code-review-graph at user level for those who want them; `features` keys list), `CONTRIBUTING.md` (prerequisites, fragment naming and tier examples), `IDEAS.md` (drop the serena and `uvx` items), `docs/INJECTION-FLOWS.md` (tier chains are one-entry, no MCP tools in agents); verify the files render and `git grep` finds no MCP names in them
- [x] 8.2 Remove the code-review-graph section from the repository's `CLAUDE.md` (design D-6); verify `grep -n "code-review-graph" CLAUDE.md` is empty

## 9. Branches and issue #38

- [x] 9.1 After user confirmation, delete the remote branch `fix/38-serena-activation-docs` (merged as #42 into `improvements-pack`); verify `git ls-remote --heads origin fix/38-serena-activation-docs` is empty and `fix/stop-hook-graph-update` is absent too
- [x] 9.2 Record in the PR description that issue #38 is resolved by this change and the `hooks/hooks.json` resolution for the next `main` -> `staging/v3` merge (design Risks). Closing #38 (`gh issue close 38 -c "Resolved by #<PR>"`) happens after the merge, with closing #75

## 10. Acceptance

- [x] 10.1 Run `git grep -nE "mcp__plugin_bdk|code-review-graph|serena|uvx" -- . ':!docs/v3' ':!docs/adr' ':!openspec' ':!tests/evals/**/iterations/**' ':!docs/V3-IMPLEMENTATION-PLAN.md' ':!docs/V3-SKILL-INVENTORY.md'`; verify it prints nothing
- [x] 10.2 Start `claude --plugin-dir <this checkout>` in a scratch project with a `.bdk/settings.json` that still sets `features.serena: true`; verify `/mcp` lists no BDK server, `pgrep -fl uvx` shows no process started by the session, the session context shows the unknown-key warning and no block, and `/exit` triggers no `uvx` process
- [x] 10.3 Render `STARTUP_INSTRUCTIONS.md` and resolve each `bdk-tier-*` skill (run its `!` command) with features off and with both removed keys on; verify the outputs are identical per tier and show the built-in-tools text
- [x] 10.4 Run `pytest tests/unit/` and `node --test tests/contract/*.test.mjs`; verify both pass
- [x] 10.5 Run `openspec validate v3-t04-remove-bundled-mcp --strict`; verify it passes
