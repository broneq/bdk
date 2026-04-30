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
- `chain`: array of entries, each with optional `"if"` (AND conditions) and required `"then"` (path relative to chain file)
- Entry without `"if"` is an unconditional fallback

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
| Suppress block when better tool available | `--prefer` |

## Graph-Only Skills

Skills `graph-explore`, `graph-debug`, `graph-review`, `graph-refactor` require code-review-graph by design. They make no sense without it. **Do not apply chain migration to these skills.** They stay hardcoded.

## Agents vs Skills

Agent `.md` files are static markdown — shell commands do not execute at load time. `inject.py --chain` cannot be used in agents. Agent tool preferences come from `STARTUP_INSTRUCTIONS.md` (assembled via chains) and from explicit Serena tool subsections in the agent body.
