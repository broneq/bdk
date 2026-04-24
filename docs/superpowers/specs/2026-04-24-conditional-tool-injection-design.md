# Conditional Tool Injection — Design Spec

**Date:** 2026-04-24  
**Branch:** feature/bdk-plugin  
**Status:** Draft

---

## Problem

BDK skills and agents reference MCP tools (code-review-graph, Serena) unconditionally. When a user disables these features in `.bdk/settings.json`, instructions still appear in context — wasting tokens and confusing Claude. There is also no standard fallback chain: each skill author invents their own conditional logic, and Serena's most powerful tools are not surfaced anywhere.

Three specific gaps:

1. **Serena underused** — instructions missing from most skills, powerful tools (insert_before/after_symbol, replace_symbol_body, rename_symbol, find_referencing_symbols) never taught
2. **Serena misused** — invoked when code-review-graph would be cheaper and faster
3. **No standard fallback chain** — skills hard-code tool references with no consistent fallback pattern

---

## Solution Overview

Three changes, layered:

1. Extend `inject.py` with `--prefer` flag and `--chain` mode
2. Build a root `fragments/tool-tiers/` library with chain config files
3. Refactor STARTUP_INSTRUCTIONS.md + update general skills to use the chain system
4. Enrich agent body text with Serena powerful tool instructions

---

## 1. inject.py — `--prefer` Flag

### Semantics

```
inject block IF:
  all --if conditions are true
  AND none of the --prefer conditions are true
```

`--prefer` suppresses the block when any preferred feature is **true** in settings. If the preferred feature is false or missing, `--if` still wins.

### CLI

```bash
# hard requirement — only if serena enabled AND codegraph not available
inject --if features.serena --prefer features.code-review-graph --then search-serena.md

# fallback — only if neither available
inject --then search-fallback.md --prefer features.code-review-graph --prefer features.serena
```

`--prefer` is repeatable. Multiple `--prefer` flags use OR semantics — any one true suppresses the block.

### Module API

```python
inject(
    conditions: list[str],
    prefer_conditions: list[str],
    then_path: str | None,
    then_text: str | None,
    settings: dict | None
) -> str
```

---

## 2. inject.py — `--chain` Mode

### Why

A fallback chain (codegraph → serena → grep) needs three inject calls in sequence. Inlining all three in every SKILL.md is repetitive. `--chain` moves the chain definition to a JSON config file; inject.py resolves it to a single output.

### CLI

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py \
  --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json
```

### Chain File Format

**Exclusive mode** — injects first matching block only (fallback chain):

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "fragments/tool-tiers/search-graph.md" },
    { "if": ["features.serena"], "then": "fragments/tool-tiers/search-serena.md" },
    { "then": "fragments/tool-tiers/search-fallback.md" }
  ]
}
```

**Additive mode** — injects all matching blocks (complementary tools):

```json
{
  "mode": "additive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "fragments/tool-tiers/edit-graph.md" },
    { "if": ["features.serena"], "then": "fragments/tool-tiers/edit-serena.md" }
  ]
}
```

Paths in chain files are resolved relative to the chain file's own directory.

### When to use `--chain` vs `--if`/`--prefer`

| Situation | Use |
|-----------|-----|
| Fallback tier system (codegraph → serena → grep) | `--chain` with `exclusive` |
| Complementary tools (both useful together) | `--chain` with `additive` |
| Simple one-off conditional fragment | `--if` / `--prefer` inline |

Both modes coexist — `--chain` is not a replacement for `--if`/`--prefer`.

---

## 3. Fragment Library

### Structure

```
fragments/
  code-review-graph/          # existing — keep as-is
    step1-scope.md
  tool-tiers/                 # new
    search.chain.json         # exclusive
    search-graph.md
    search-serena.md
    search-fallback.md

    edit.chain.json           # additive
    edit-graph.md             # impact analysis before edits
    edit-serena.md            # insert_before/after, replace_symbol_body, rename_symbol

    impact.chain.json         # exclusive
    impact-graph.md
    impact-fallback.md        # no serena tier (serena can't do impact analysis)

    review.chain.json         # exclusive
    review-graph.md
    review-fallback.md

    explore.chain.json        # additive
    explore-graph.md
    explore-serena.md
```

### Serena Content (what gets added)

`search-serena.md` teaches:
- `find_symbol` — locate named symbols by name_path + relative_path
- `search_for_pattern` — flexible regex/text pattern search
- `find_referencing_symbols` — trace all usages of a symbol
- `get_symbols_overview` — scan a file's symbol structure without reading body

`edit-serena.md` teaches:
- `replace_symbol_body` — replace entire function/class body
- `insert_before_symbol` / `insert_after_symbol` — inject code at structural boundaries
- `rename_symbol` — safe rename with reference updates
- `safe_delete_symbol` — delete with usage check

`explore-serena.md` teaches:
- `get_symbols_overview` — file-level symbol map
- `find_symbol` with substring matching for broad discovery

### Decision: Exclusive vs Additive per fragment

| Fragment | Mode | Reason |
|----------|------|--------|
| search | exclusive | Redundant to search both codegraph and grep |
| edit | additive | Codegraph impact + Serena AST edits are complementary |
| impact | exclusive | Codegraph wins; Serena cannot do impact analysis |
| review | exclusive | Codegraph first; grep fallback |
| explore | additive | Codegraph overview + Serena symbol detail = complementary |

---

## 4. STARTUP_INSTRUCTIONS.md Refactor

Replace hard-coded tier instructions with `--chain` calls. Result: if codegraph is disabled, its instructions never appear. If Serena is disabled, same.

Before (hard-coded):
```markdown
## Tool Preference
1. code-review-graph — use first
2. Serena — use second  
3. Grep/Read — fallback
```

After (assembled):
```bash
$(python3 inject.py --chain fragments/tool-tiers/search.chain.json)
$(python3 inject.py --chain fragments/tool-tiers/edit.chain.json)
$(python3 inject.py --chain fragments/tool-tiers/explore.chain.json)
```

---

## 5. Skill Changes

### Two categories of skills

**Graph-only skills — no changes needed:**

Skills `graph-explore`, `graph-debug`, `graph-review`, `graph-refactor` require code-review-graph by design. They make no sense without it. These skills stay as-is. A guard message may be added if codegraph is disabled, but no chain migration applies.

**General skills — migrate tool-reference steps to `--chain` calls:**

| Skill | Lines to replace | Chain fragment |
|-------|-----------------|----------------|
| `skills/debug/SKILL.md` | Phase 2 investigation steps (graph tool calls ~lines 82-87) | `explore.chain.json` + `search.chain.json` |
| `skills/create-plan/SKILL.md` | Phase 2 exploration steps (graph tool calls ~lines 50-53) | `explore.chain.json` |
| `skills/cr/SKILL.md` | Step 1 scope steps (graph tool calls ~lines 51-54) | already has `fragments/code-review-graph/step1-scope.md` — extend with chain |
| `skills/refactor/SKILL.md` | Workflow architecture survey (~lines 18-21) | `explore.chain.json` |
| `skills/test-driven-development/SKILL.md` | Graph tool references | `search.chain.json` |
| `skills/explain-complex-code/SKILL.md` | Graph tool references | `explore.chain.json` + `search.chain.json` |

**Migration pattern for each skill:**

```markdown
## Phase 2: Investigate

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`
```

`allowed-tools:` frontmatter entries for graph/serena tools are removed from general skills — the chain fragments define what's available contextually.

---

## 6. Agent Changes

### Constraint

Agent `.md` files are static markdown. Shell commands do not execute. `inject.py --chain` cannot be used in agents.

### Approach

Agent `tools:` frontmatter arrays and tier body text stay structurally as-is. The behavioral tier preference comes from STARTUP_INSTRUCTIONS.md (assembled via chains). Agent body text is enriched with Serena's powerful tool instructions — currently absent.

**Agents that need Serena tool enrichment:**

| Agent | Missing Serena instructions |
|-------|---------------------------|
| `agents/explorer.md` | `find_referencing_symbols`, `get_symbols_overview` usage patterns |
| `agents/code-reviewer.md` | `replace_symbol_body`, `insert_before/after_symbol` for suggesting fixes |
| `agents/architecture-reviewer.md` | `rename_symbol`, `find_referencing_symbols` for impact analysis |
| `agents/dead-code-detector.md` | `safe_delete_symbol`, `find_referencing_symbols` |
| `agents/duplicate-detector.md` | `find_referencing_symbols`, `get_symbols_overview` |
| `agents/step-simulator.md` | `find_symbol`, `get_symbols_overview` |
| `agents/log-analyzer.md` | `find_symbol`, `search_for_pattern` usage patterns |

**What changes in agent body text:** Add a "Serena tools" subsection under the existing tool hierarchy describing when and how to use the powerful structural editing/analysis tools. This is additive — no existing lines removed.

---

## 7. Documentation

### `.claude/rules/fragment-system.md` (new)

Covers:
- What fragments are and where they live (root `fragments/` vs skill-local `skills/<name>/fragments/`)
- Chain file format and both modes
- When to use `--chain` vs `--if`/`--prefer`
- When to use exclusive vs additive mode
- Graph-only skills vs general skills distinction
- How agents differ from skills (static — no inject.py)

### `CONTRIBUTING.md` (update)

Add section: **Writing Fragments**
- How to create a new tool-tier fragment
- How to create a chain file
- How to reference fragments from SKILL.md
- Naming conventions
- When NOT to use chains (graph-only skills)

---

## Implementation Order

1. `inject.py` — add `--prefer` flag + tests
2. `inject.py` — add `--chain` mode + tests
3. `fragments/tool-tiers/` — create leaf content files (search, edit, impact, review, explore) with Serena + codegraph + fallback variants
4. `fragments/tool-tiers/` — create chain config files
5. `STARTUP_INSTRUCTIONS.md` — refactor to use chains
6. General skills — migrate to `--chain` calls (`debug`, `create-plan`, `cr`, `refactor`, `tdd`, `explain-complex-code`)
7. Agents — enrich body text with Serena powerful tool instructions (all 7 agents)
8. `.claude/rules/fragment-system.md` — write rule doc
9. `CONTRIBUTING.md` — add fragment authoring section

---

## Out of Scope

- Changing `.bdk/settings.json` schema (feature flags already exist)
- New MCP tools or Serena configuration
- Changes to graph-only skills (graph-explore, graph-debug, graph-review, graph-refactor)
- Converting agents to skills for dynamic injection
