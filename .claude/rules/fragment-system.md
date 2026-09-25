# Fragment System

BDK's conditional injection system: how fragments are structured, how chains work, and when to use each mode.

## What Are Fragments

Fragments are Markdown files injected at skill load time based on `.bdk/settings.json` feature flags. Unlike `references/` (always loaded), fragments are **only included** when their condition matches.

## Directory Layout

```
fragments/
  tool-tiers/          <- shared, multi-skill
    search.chain.json
    search-fallback.md
    edit.chain.json
    edit-fallback.md
    impact.chain.json
    impact-fallback.md
    review.chain.json
    review-fallback.md
    explore.chain.json
    explore-fallback.md
  <capability>/        <- other shared fragment groups
    step1-*.md

skills/<skill-name>/
  fragments/           <- skill-local conditional fragments
    react.md
    typescript-strict.md
```

## Chain File Format

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.react", "languages[typescript]"], "then": "react-ts.md" },
    { "if": ["features.react"], "then": "react.md" },
    { "then": "plain.md" }
  ]
}
```

- `mode`: `"exclusive"` or `"additive"`
- `chain`: array of entries, each with optional `"if"` (AND conditions), optional `"prefer"` (OR conditions that **suppress** the entry), and required `"then"` (path relative to chain file)
- Entry without `"if"` is an unconditional fallback. It renders even when the project has no `.bdk/settings.json`; conditional entries need settings to match.

**In an `additive` chain, a fallback must guard itself with `prefer`.** Additive mode injects *every* matching entry, so a bare unconditional fallback stacks on top of the entries it was meant to replace - the reader gets both texts, with contradictory rules, and nothing errors. List every entry the fallback defers to:

```json
{ "prefer": ["features.react", "features.vue"], "then": "plain.md" }
```

`exclusive` chains do not need this: they break on the first match, so a bare fallback is only reached when nothing above it matched. `tests/unit/fragments/test_tier_chain_render.py` enforces the additive half on every chain in `fragments/tool-tiers/`.

Each fragment is self-contained: it carries its own tool list AND the policy rules governing those tools. There is no shared header file.

## Modes

| Mode | Behaviour | Use when |
|------|-----------|----------|
| `exclusive` | Inject first matching entry only | Variants that replace each other (framework-specific text, plain fallback) |
| `additive` | Inject all matching entries | Complementary fragments (both useful together) |

## Tool-Tier Chains

Since ADR-0001 the plugin ships no MCP server, so each of the five tool-tier chains (`search`, `explore`, `impact`, `edit`, `review`) holds one unconditional entry naming built-in tools only. The chains stay chains so `render_startup.py`, `inject.py --chain` and the `bdk-tier-*` meta-skills keep one delivery path; `tests/unit/fragments/test_tier_chain_render.py` asserts the rendered text does not change with `features`.

## When to Use `--chain` vs `--if`/`--prefer`

| Situation | Use |
|-----------|-----|
| Variants that replace each other | `--chain` with `exclusive` |
| Complementary fragments | `--chain` with `additive` |
| Simple one-off conditional | `--if` / `--prefer` inline |
| Suppress block when a better variant applies | `--prefer` inline, or a `"prefer"` key on a chain entry |

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
