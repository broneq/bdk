# Tasks

## 1. Failing tests first

- [x] 1.1 Write the temporary guard `tests/unit/test_no_tool_tiers.py` (design D-5; deleted in 5.3).
  - Scan `agents/`, `skills/`, `fragments/`, `rules/`, `hooks/`, `scripts/` and `STARTUP_INSTRUCTIONS.md` for `bdk-tier-`, `--chain`, `<!-- CHAIN:` and `.chain.json`. Report file and line.
  - Assert that `fragments/tool-tiers/`, `skills/bdk-tier-*` and `scripts/render_startup.py` do not exist.
  - Verify: the test fails today.
- [x] 1.2 Add a case to `tests/unit/scripts/test_inject.py` (design D-3): running the CLI with an unknown flag (`--chain x.json`) prints a stdout line starting with `[bdk-inject-error]`, exits 0 and writes nothing to stderr.
  - Verify: the case fails today, because argparse exits 2 on stderr, or because `--chain` is still accepted.

## 2. Remove the tier layer

- [x] 2.1 Delete `fragments/tool-tiers/` and `skills/bdk-tier-{search,explore,impact,edit,review}/`.
- [x] 2.2 Remove every `bdk-tier-*` entry from agent `skills:` frontmatter.
  - Drop the `skills:` key from `dead-code-detector`, `duplicate-detector`, `explorer` and `log-analyzer`.
  - Replace "Follow the tool-tier and quality-rule guidance from your preloaded skills." with "Follow the quality-rule guidance from your preloaded skills." in agents that keep preloads, and delete the sentence in the other four (design D-4).
  - Verify: `grep -rn "bdk-tier\|tool-tier" agents/` is empty and `tests/unit/agents/` passes.
- [x] 2.3 Remove the 8 `inject.py --chain` lines from `cr`, `debug` (2), `design`, `explain-complex-code`, `refine-rules`, `test-driven-development` and `update-docs`. Rewrite the prose around each site per design D-4.
- [x] 2.4 Change the 9 skill headers "for project context and tool guidance." to "for project context.". Reword `skills/create-plan/references/explorer-prompts.md` line 14 so it no longer points at preloaded tool guidance.
  - Verify: `grep -rn "tool guidance\|tools above\|Tool tier" skills/` is empty.
- [x] 2.5 In `scripts/inject.py`:
  - Remove `inject_chain`, `--chain`, the chain branch of `main` and the chain lines of the module docstring.
  - Make argparse errors print `[bdk-inject-error] inject: <message>` on stdout and exit 0 (design D-3).
  - Remove the chain cases from `tests/unit/scripts/test_inject.py`.
  - Verify: `test_inject.py` passes, including 1.2.
- [x] 2.6 Delete `scripts/render_startup.py` and `tests/unit/scripts/test_render_startup.py`, and change the SessionStart entry in `hooks/hooks.json` to `cat "${CLAUDE_PLUGIN_ROOT}/STARTUP_INSTRUCTIONS.md"`. Remove the `## Tool Guidance` section, with its three markers, from `STARTUP_INSTRUCTIONS.md`.
  - Verify: `python3 -m json.tool hooks/hooks.json` passes.
- [x] 2.7 Delete `tests/unit/fragments/test_tier_chain_render.py` (and `tests/unit/fragments/` if it is left empty).
- [x] 2.8 Drop tool names from skill and agent steps (design D-4): each step says what to find or check, not which tool to use. Tool names stay only in `tools:` / `allowed-tools` frontmatter and where the tool is the subject (`Agent`, `AskUserQuestion`). Add the "No tool guidance" note to `.claude/rules/skill-creation-rules.md`.
  - Verify: `grep -rnE "\b(Grep|Glob)\b" skills agents STARTUP_INSTRUCTIONS.md` matches only `tools:` frontmatter lists.
  - Verify: the guard from 1.1 passes.

## 3. Kernel contract and plan

- [x] 3.1 Apply the `kernel-cli/ctx` and `kernel-architecture` deltas to `schema/cli/`:
  - `commands.json`: `ctx-skill` summary without "tool tiers";
  - `output/ctx.json`: description without "tool tiers", `tier` removed from the `kind` enum, and the example with a `rules` part and `## Code quality` content.
  - Verify: `node --test tests/contract/*.test.mjs` passes. Run it again after archive, when the main specs carry the new text.
- [x] 3.2 Edit the T13 scope in `docs/V3-IMPLEMENTATION-PLAN.md` (design D-6): `ctx skill` composes conditional fragments without chain semantics, and `ctx startup` renders STARTUP with the agents table without resolved chains. Leave the T02 section and `docs/V3-SKILL-INVENTORY.md` unchanged.

## 4. Rules and docs

- [x] 4.1 `.claude/rules/fragment-system.md`: remove the chain file format, the modes, "Tool-Tier Chains" and "When to Use `--chain`". Keep the fragment basics, the agents-versus-skills section with `skills:` preload (using a `bdk-rules-*` example) and the three `rules/` directories. Also:
  - `.claude/rules/inject-fragments.md`: remove "Chain files", the multi-tier bullet and `--chain` from the mechanism table.
  - `.claude/rules/skill-creation-rules.md`: the missing-settings bullet no longer mentions chains, and the `render_startup.py` exemption goes.
  - `.claude/rules/portability-check.md`: remove `bdk-tier-*` from the exempt list.
  - Verify: `grep -rn "chain\|tier" .claude/rules .claude/skills` shows no tool-tier or chain-injection reference.
- [x] 4.2 Update `CONTRIBUTING.md`: in "Built-in Tools Only", remove the sentence about tool-tier chains; in "Writing Fragments", remove "Creating a Chain File", "Referencing a Chain" and the chain naming bullets, and state that agents use `skills:` preload of `bdk-rules-*`. Also:
  - `README.md` "Code tools": one sentence saying BDK adds no tool-guidance layer on top of the host tools.
  - `docs/INJECTION-FLOWS.md`: extend the update note (tool-tier chains, `render_startup.py` and `bdk-tier-*` removed; STARTUP is static).
  - Verify: `grep -n "chain\|bdk-tier\|render_startup" README.md CONTRIBUTING.md` shows nothing stale.

## 5. Acceptance

- [x] 5.1 Run `pytest tests/unit/` and `node --test tests/contract/*.test.mjs`. Verify both pass.
- [x] 5.2 Run `git grep -nE "bdk-tier|tool-tiers|--chain|CHAIN:|render_startup|inject_chain" -- . ':!docs/v3' ':!docs/adr' ':!openspec/changes/archive' ':!tests/evals/**/iterations/**' ':!docs/V3-SKILL-INVENTORY.md' ':!docs/INJECTION-FLOWS.md'`.
  - Verify: the only matches are the plan's finished T02 section and the removal note in `README.md` / `CONTRIBUTING.md`, if any. List each remaining match in the PR.
- [x] 5.3 Delete the absence guards `tests/unit/test_no_tool_tiers.py` and `tests/unit/test_no_mcp_names.py`. Add one line to `.claude/rules/script-tests.md` "What to Test": a removal may be driven by a failing absence test, but that test is deleted once the removal lands; the PR's acceptance grep is the proof (design D-5).
  - Verify: `pytest tests/unit/` still passes.
- [x] 5.4 E2E: start `claude -p --plugin-dir <this checkout>` in a scratch project, once with `.bdk/settings.json` and once without.
  - Verify: the session context contains `# BDK Shared Foundation`, byte-identical to `STARTUP_INSTRUCTIONS.md` in both runs, with no `Tool Guidance` section and no `[bdk-inject-error]`.
  - Verify: spawning `bdk:explorer` on a small search returns a result, so an agent with no preload still works.
- [x] 5.5 Run `openspec validate v3-t04-drop-tool-tiers --strict`. Verify it passes.
- [x] 5.6 After archive:
  - Edit the `plugin-tooling` main spec Purpose line to drop "one tool-tier text for every project".
  - Add the merge note to the PR #76 description: resolve `scripts/`, `fragments/` and `skills/bdk-tier-*` to `staging/v3` on the next `main` merge.
  - Verify: `openspec validate --specs --strict` passes.
