# Design

## Context

After `v3-t04-remove-bundled-mcp` the tool-tier layer is still in place:

- five `fragments/tool-tiers/*.chain.json`, each holding one unconditional entry, and five `*-fallback.md` fragments;
- five `bdk-tier-*` meta-skills, preloaded into 10 agents;
- 8 `inject.py --chain` calls in 7 skills;
- three `<!-- CHAIN -->` markers in `STARTUP_INSTRUCTIONS.md`, which `scripts/render_startup.py` expands at SessionStart.

The chain feature itself (`mode`, `if`, `prefer`) has no other user: `decision-tier` uses `--if`. On the kernel side, the T10 contract has `bdk ctx` compose a `tier` part kind, and the T13 scope in the plan asks `ctx skill` to implement chain semantics.

## Goals / Non-Goals

**Goals:**

- Remove the tool-tier layer and the chain mechanism it was the only user of, from the plugin, the tests, the dev rules and the kernel contract.
- Keep each agent and skill step usable by saying what to find or check, not which tool to use.
- Make a leftover `--chain` call visible rather than silently empty.

**Non-Goals:**

- Replacing the other meta-skill preloads (`bdk-rules-*`, `bdk-lint-tools`, `bdk-test-tools`) with role skills (T42).
- Removing `inject.py --prefer` or any other part of the Python injection scripts (T32 cuts them as a whole).
- Implementing `bdk ctx` (T13).

## Decisions

### D-1 Remove the layer; keep no replacement guidance file

**Reverses** `v3-t04-remove-bundled-mcp` D-1 ("chains stay as one-entry chains").

The tier texts say three things:
- which tools exist;
- how to call them;
- a few habits: scope every search to a path, treat "no match" as absence, sample before reading.

The host's system prompt already covers the first two. The habits are generic search hygiene that the model follows without being told. By the routing in `STARTUP_INSTRUCTIONS.md` "Capture Conventions" ("Anything else -> nothing"), none of it needs a home.

Alternatives considered:
- **Keep one-entry chains** (the old D-1). Lost: no chain can gain a second entry without a new bundled tool, which ADR-0001 rules out. Keeping them means paying for machinery that only a hypothetical future needs.
- **Collapse into one static `tool-guidance.md`, included in STARTUP and preloaded into agents.** Lost: it saves the machinery but keeps the context cost for content the host already supplies.
- **Inline the tier text into each agent body.** Lost: it copies the same generic text 10 times. The host's system prompt already gives this advice.

### D-2 Chains go from `inject.py`; STARTUP becomes a static file

With no chain file left, the following are dead code:
- `inject_chain`, `--chain` and the `exclusive` / `additive` / `prefer`-in-chain semantics;
- `render_startup.py`, whose only job is to expand chain markers.

The SessionStart entry goes back to printing the file: `cat "${CLAUDE_PLUGIN_ROOT}/STARTUP_INSTRUCTIONS.md"`. That is the pre-renderer form `docs/INJECTION-FLOWS.md` Flow 2 documents, and it now works because the file has no dynamic content left.

Alternatives considered:
- **Keep `render_startup.py` as a pass-through.** Lost: it is a Python process with no job.
- **Keep `--chain` for future non-tier chains.** Lost: YAGNI. When a real need appears, the need will shape the syntax, and T13 designs `bdk ctx` from scratch anyway.

`--prefer` stays. It is an inline flag of the `--if` mode, the tier layer never used it, and removing it is an unrelated cleanup of a script that T32 deletes.

### D-3 Argument errors follow the stdout error contract

Today `inject.py` handles bad arguments with argparse's `parser.error`, which writes to stderr and exits 2. A `!` block captures stdout only, so a stale `--chain` call, or any other bad call, renders as an empty block. That breaks the contract `.claude/rules/skill-creation-rules.md` states: a broken injection prints `[bdk-inject-error] <desc>` on stdout and exits 0.

The fix is to override the parser's error path so that argument errors print `[bdk-inject-error] inject: <argparse message>` on stdout and exit 0.

Alternative considered:
- **Keep a `--chain` stub that prints a removal message.** Lost: it special-cases one removed flag, while the general fix covers every bad call.

### D-4 Skill and agent text

At each of the 8 skill sites, the `!` line goes. Skill and agent text says what to find or check, never which tool to use: the model already knows its tools, and a named tool only repeats the host's own guidance. (User decision, 2026-09-25.) Any sentence that pointed at "the tools above" or "tool tier", or named `Grep`, `Glob`, `Read` or `Bash` for a search, becomes a plain statement of what to find:

- **`cr` "Tool tier for reading the change set":** the paragraph asks for choke points, impacted paths and a risk score per file, which only the graph tier could supply. Rewrite it to what `git diff --stat` and the callers of changed symbols give.
- **`debug`:**
  - "Inject available search tools / Using the search tools above" is removed.
  - The blast-radius step becomes "find every reference to the symbols you will change, in source and in tests".
- **`test-driven-development`, `explain-complex-code`, `update-docs`:** the intro and discovery lines say what to find. The `Glob` / `Grep` call examples in `explain-complex-code/references/examples.md` become lists of what was found.
- **`design`, `refine-rules`:** the `!` line is removed. The surrounding text needs no tool pointer.
- **Agents:** process steps in `code-reviewer`, `dead-code-detector`, `architecture-reviewer`, `duplicate-detector`, `plan-verifier` and `design-verifier` drop tool names the same way.

Agents:
- Agents that keep other preloads say "Follow the quality-rule guidance from your preloaded skills."
- Agents left with no preload (`dead-code-detector`, `duplicate-detector`, `explorer`, `log-analyzer`) lose the sentence and the `skills:` key.

Skill headers change from "... for project context and tool guidance." to "... for project context.". The `create-plan` explorer prompt drops "Use the tool guidance your skills frontmatter has loaded".

### D-5 Absence guards are scaffolding, not suite members

A test that only asserts something removed is still absent protects nothing once the removal has landed. It turns every later mention of the removed name into a failure that has to be argued with, and it grows the suite with checks that describe history rather than behaviour. (User decision, 2026-09-25.)

So the removal is driven by a temporary guard and ends without one:

- `tests/unit/test_no_tool_tiers.py` is written first and fails. It scans the shipped set (`agents`, `skills`, `fragments`, `rules`, `hooks`, `scripts`, `STARTUP_INSTRUCTIONS.md`) for `bdk-tier-`, `--chain`, `<!-- CHAIN:` and `.chain.json`, and checks that the removed paths are gone. It drives tasks 2.x and is deleted in the last task group.
- `tests/unit/test_no_mcp_names.py`, the same kind of guard from `v3-t04-remove-bundled-mcp`, is deleted with it. `plugin-tooling` "No MCP names in the plugin" is replaced by "Plugin names no removed MCP server", which keeps the repository-search scenario and drops the test scenario (OpenSpec cannot drop a scenario through MODIFIED).
- The tests that exercise removed code go with that code: `test_tier_chain_render.py`, `test_render_startup.py` and the chain cases in `test_inject.py`.
- The D-3 case in `test_inject.py` stays: it tests live behaviour of `inject.py`, not an absence.
- `.claude/rules/script-tests.md` gets one line under "What to Test" so later removals follow the same pattern.

Alternative considered:
- **Keep permanent guards** (the original draft of this design, and `v3-t04-remove-bundled-mcp` D-4). Lost: see above; the acceptance `git grep` in the PR proves the removal once, which is all that is needed.

### D-6 Kernel contract and plan

- **`kernel-cli/ctx`** (MODIFIED `bdk ctx skill`, `bdk ctx role`, `bdk ctx startup`):
  - The summary drops "tool tiers".
  - The resolution order drops "fragment chains" in favour of "fragments".
  - The examples lose their `tier` part.
  - `schema/cli/output/ctx.json` drops `tier` from the `kind` enum, and its example changes to match.
  - `schema/cli/commands.json` changes the `ctx-skill` summary.
- **`kernel-architecture`** (MODIFIED "Vertical slices"): the `ctx` row reads "fragments, rules, prompt values, the agents table".
- **Plan, T13 scope:** `ctx skill` composes "conditional fragments" (no chains, no `exclusive` / `additive` semantics), and `ctx startup` renders STARTUP with the agents table but without "resolved chains". This is the task's own future scope, so editing it is not reopening a decision. The finished T02 section and `docs/V3-SKILL-INVENTORY.md` stay as records.
- **`plugin-tooling` Purpose line** ("one tool-tier text for every project"): archive does not rewrite Purpose. Tasks edit it right after archive.

## Risks / Trade-offs

- **[Subagents lose explicit search habits, such as "scope every search to a path"]** -> These are generic, and the host prompt covers tool use. If evals show a regression, the fix is one line in the affected agent's process step, not a layer.
- **[A user's project-level skill calls `inject.py --chain`]** -> After D-3 it shows a `[bdk-inject-error]` line instead of silently rendering nothing. The README change list names the removal.
- **[`cat` availability on Windows hosts]** -> Claude Code runs plugin hook commands through a shell, and the pre-renderer v2 hook used `cat` the same way. T13 replaces the hook with `bdk hooks session-start` in any case.
- **[Merge with `main`]** -> `main` still has `render_startup.py` and the chains. The next `main` -> `staging/v3` merge resolves `hooks/hooks.json`, `scripts/`, `fragments/` and `skills/bdk-tier-*` to the `staging/v3` side. Record this in the PR description next to the existing `hooks.json` note.

## Migration Plan

1. Land this change on `v3/T04-remove-bundled-mcp`, in PR #76, together with `v3-t04-remove-bundled-mcp`.
2. The backport to `main` (already planned as a separate PR after the merge) carries both changes.

Rollback is reverting the change's commits. No user data or settings are involved.

## Open Questions

None.
