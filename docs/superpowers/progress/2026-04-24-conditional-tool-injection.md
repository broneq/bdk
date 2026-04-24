# Conditional Tool Injection — Progress

**Plan:** `docs/superpowers/plans/2026-04-24-conditional-tool-injection.md`
**Branch:** `feature/bdk-plugin`
**Status:** Implementation complete. Agent hook injection implemented.

## What's Done

All 9 tasks from the plan implemented (no commits — user handles git):

1. **`scripts/inject.py` — `--prefer` flag** — OR suppression semantics
2. **`scripts/inject.py` — `--chain` mode** — exclusive/additive dispatch + `inject_chain()`
3. **Fragment leaf files (11 `.md`)** in `fragments/tool-tiers/` — search/edit/impact/review/explore × graph/serena/fallback
4. **Chain configs (5 `.chain.json`)** in `fragments/tool-tiers/`
5. **`STARTUP_INSTRUCTIONS.md`** refactored — hardcoded tier text → 3 `--chain` inject calls
6. **6 skills migrated** (debug, create-plan, cr, refactor, test-driven-development, explain-complex-code)
7. **7 agents enriched** with static Serena tool subsections (explorer, code-reviewer, architecture-reviewer, dead-code-detector, duplicate-detector, step-simulator, log-analyzer)
8. **`.claude/rules/fragment-system.md`** — fragment system doc
9. **`CONTRIBUTING.md`** — "Writing Fragments" section

**Test status:** 192 unit tests pass (48 inject tests, zero regressions).

## Agent Context Injection — Resolved

**Problem:** Plan deliberately used static Serena subsections for agents because inline `` !`inject.py --chain` `` does not execute in agent bodies. User wanted to verify alternatives.

**Empirically tested:**

| Mechanism | Result |
|-----------|--------|
| Inline `` !`cmd` `` in agent body | Literal text — no shell execution |
| `skills:` frontmatter field | Not tested (user rejected — "I don't want strange constructions") |
| `SessionStart` hook in agent frontmatter | Hook DOES fire on subagent spawn. Confirmed 2026-04-24. Must use `hookSpecificOutput` JSON format — plain text stdout is ignored. |
| `PreToolUse` hook in agent frontmatter | Hook DOES fire. Exit 2 stderr feeds back to agent. Blocks the tool call though — useful for validation/gating, not for spawn-time context injection |

**Conclusion:** `SessionStart` hook in agent frontmatter with `hookSpecificOutput` JSON is a working mechanism to inject computed content into a subagent's context at spawn time.

## Agent Hook Injection — Implemented (2026-04-24)

1. **`scripts/hook_inject.sh`** — NEW wrapper. Takes chain filename, runs `inject.py --chain`, wraps non-empty output in `hookSpecificOutput` JSON.

2. **5 agents migrated** to SessionStart hook injection:

| Agent | Hooks | Removed section |
|-------|-------|-----------------|
| `explorer` | explore.chain.json + search.chain.json | `### Serena Tool Patterns` |
| `code-reviewer` | review.chain.json + search.chain.json | `## Serena Tool Patterns` |
| `architecture-reviewer` | explore.chain.json + search.chain.json | `### Serena Structural Analysis` |
| `dead-code-detector` | search.chain.json | `### Serena Fallback Detection` |
| `duplicate-detector` | search.chain.json | `### Serena Symbol Patterns` |

3. **`.claude/agents/inject-agent.md`** — test artifact deleted.

**Hook command pattern:**
```yaml
hooks:
  SessionStart:
    - hooks:
        - type: command
          command: "bash ${CLAUDE_PLUGIN_ROOT}/scripts/hook_inject.sh <chain>.chain.json"
```

## Files Changed (uncommitted)

```
D  .claude/agents/inject-agent.md
A  .claude/rules/fragment-system.md
 M CONTRIBUTING.md
 M STARTUP_INSTRUCTIONS.md
 M agents/{architecture-reviewer,code-reviewer,dead-code-detector,duplicate-detector,explorer,log-analyzer,step-simulator}.md
A  fragments/tool-tiers/{10 leaf .md + 5 .chain.json}
 M scripts/inject.py
A  scripts/hook_inject.sh
 M skills/{cr,create-plan,debug,explain-complex-code,refactor,test-driven-development}/SKILL.md
 M tests/unit/scripts/test_inject.py
```

## Next Steps

- Run `superpowers:finishing-a-development-branch` when ready to merge
