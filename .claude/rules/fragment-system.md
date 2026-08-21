# Fragment System

BDK's conditional injection system: how fragments are structured, how chains work, and when to use each mode.

## What Are Fragments

Fragments are Markdown files injected at skill load time based on `.bdk/settings.json` feature flags. Unlike `references/` (always loaded), fragments are **only included** when their condition matches.

## Directory Layout

```
fragments/
  tool-tiers/          ← shared, multi-skill
    search.chain.json
    search-graph.md
    search-serena.md
    search-fallback.md
    edit.chain.json
    edit-graph.md
    edit-serena.md
    impact.chain.json
    impact-graph.md
    impact-fallback.md
    review.chain.json
    review-graph.md
    review-fallback.md
    explore.chain.json
    explore-graph.md
    explore-serena.md
  <capability>/        ← other shared fragment groups
    step1-*.md

skills/<skill-name>/
  fragments/           ← skill-local conditional fragments
    react.md
    typescript-strict.md
```

## Chain File Format

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.code-review-graph"], "then": "search-graph.md" },
    { "if": ["features.serena"], "then": "search-serena.md" },
    { "then": "search-fallback.md" }
  ]
}
```

- `mode`: `"exclusive"` or `"additive"`
- `chain`: array of entries, each with optional `"if"` (AND conditions), optional `"prefer"` (OR conditions that **suppress** the entry), and required `"then"` (path relative to chain file)
- Entry without `"if"` is an unconditional fallback

**In an `additive` chain, a fallback must guard itself with `prefer`.** Additive mode injects *every* matching entry, so a bare unconditional fallback stacks on top of the higher tiers instead of replacing them - the reader gets the graph tools and the grep tools, with contradictory policy rules, and nothing errors. List every tier the fallback defers to:

```json
{ "prefer": ["features.code-review-graph", "features.serena"], "then": "explore-fallback.md" }
```

`exclusive` chains do not need this: they break on the first match, so a bare fallback is only reached when nothing above it matched. `tests/unit/fragments/test_tier_chain_render.py` enforces both halves - every chain renders a tier with all features off, and no additive chain emits its fallback when a higher tier matched.

Each tier fragment is self-contained: it carries its own tool list AND the policy rules governing those tools. There is no shared header file.

## Modes

| Mode | Behaviour | Use when |
|------|-----------|----------|
| `exclusive` | Inject first matching entry only | Fallback tiers (codegraph → serena → grep) |
| `additive` | Inject all matching entries | Complementary tools (both useful together) |

## Tool-Tier Chains

| Chain | Mode | Reason |
|-------|------|--------|
| `search.chain.json` | exclusive | Redundant to use both codegraph and grep |
| `edit.chain.json` | additive | Impact analysis + structural editing are complementary |
| `impact.chain.json` | exclusive | Codegraph wins; Serena has no impact analysis |
| `review.chain.json` | exclusive | Codegraph first; grep fallback |
| `explore.chain.json` | additive | Architecture overview + symbol detail = complementary |

## When to Use `--chain` vs `--if`/`--prefer`

| Situation | Use |
|-----------|-----|
| Fallback tier system | `--chain` with `exclusive` |
| Complementary tools | `--chain` with `additive` |
| Simple one-off conditional | `--if` / `--prefer` inline |
| Suppress block when better tool available | `--prefer` inline, or a `"prefer"` key on a chain entry |

## Agents vs Skills

Agent `.md` files are static markdown — shell commands do not execute at load time, and the `hooks:`, `mcpServers:`, and `permissionMode:` frontmatter fields are **stripped** when an agent ships in a plugin (verbatim from the Claude Code agents reference: *"For security reasons, plugin subagents do not support the `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. These fields are ignored when loading agents from a plugin."*). `inject.py --chain` cannot be used directly inside an agent file.

Agent tool preferences are assembled by two complementary mechanisms instead:

1. **`STARTUP_INSTRUCTIONS.md`** — rendered by `scripts/render_startup.py` before the SessionStart hook returns it, so chain markers (`<!-- CHAIN: <file> -->`) are resolved to real tier guidance. The **orchestrator** session sees this. Subagents do **not** inherit it.
2. **`skills:` frontmatter on the agent** — preloads named meta-skills (e.g. `bdk-tier-search`, `bdk-rules-code-quality`) into the subagent's startup context. The skill bodies contain `!`...`` blocks that resolve at preload time, so the subagent receives the same tier/rule guidance the orchestrator gets.

`skills:` is **not** in the plugin-restricted list — it is the supported substitute for the dead `hooks: SessionStart` pattern. See `docs/INJECTION-FLOWS.md` for the full audit and migration history.

## Naming Gotcha — Three `rules/` Directories

BDK has three distinct `rules/` locations. Do not confuse them:

| Path | Owner | Purpose |
|------|-------|---------|
| `rules/` (repo root) | BDK distributor | Language-agnostic rule files shipped to end-user projects (`code-quality.md`, `architecture.md`, `design-patterns.md`). Injected via `scripts/inject-rules.py`. |
| `.claude/rules/` (this dir) | BDK dev-time | Internal conventions for developing BDK itself (`fragment-system.md`, `portability-check.md`, etc.). Not distributed. |
| `<user-project>/.claude/rules/` | End-user project | Project-specific rules injected by Claude Code at session start. May collide in name with BDK's `rules/` if a user copies rule files in — treat as separate namespaces. |

When a user project installs BDK as a plugin, the plugin's `rules/` files are accessed via `${CLAUDE_PLUGIN_ROOT}/rules/` (explicit path). The user project's `.claude/rules/` is loaded by Claude Code automatically and is a separate namespace — no collision at runtime, but the similar names can confuse contributors. Always use the full path (`${CLAUDE_PLUGIN_ROOT}/rules/`) when referencing BDK rules from scripts or skill inject calls.
