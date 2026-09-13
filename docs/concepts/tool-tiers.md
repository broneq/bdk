# Tool tiers

A skill that hardcodes `Grep` is wrong in a project with a knowledge graph. A skill that hardcodes graph tools breaks in a project without one. BDK resolves this once, centrally: the same instruction text is assembled per project from the best tooling actually available.

## The three tiers

| Tier | Provider | Nature of the answer |
|---|---|---|
| 1 | `code-review-graph` MCP server | Structural. A parsed graph of symbols, callers, flows, and communities. |
| 2 | Serena MCP server | Semantic, per symbol and per file, via a language server. |
| 3 | Built-in `Grep`, `Glob`, `Read` | Textual. Always present, never structural. |

Tier 1 and Tier 2 are optional. Tier 3 is the floor, so guidance always resolves to something usable.

## Five capabilities, five chains

Tiers are not selected globally. They are selected per capability, because the tools differ in what they are good at:

| Chain | Capability | Mode | Why that mode |
|---|---|---|---|
| `explore.chain.json` | Codebase exploration and architecture | additive | An architecture overview and symbol-level detail answer different halves of one question. |
| `search.chain.json` | Symbol search and call tracing | exclusive | Running both a graph query and a grep for the same symbol is redundant. |
| `impact.chain.json` | Blast radius and affected flows | exclusive | Only the graph computes this; Serena has no impact analysis. |
| `review.chain.json` | Change detection and risk scoring | exclusive | The graph scores risk; otherwise you read the diff. |
| `edit.chain.json` | Structural edits and refactors | additive | Impact lookup before the edit and reference-aware editing are complementary. |

`exclusive` injects the first matching entry and stops. `additive` injects every matching entry.

!!! warning
    In an additive chain the fallback tier must suppress itself when a higher tier matched, which it does with a `prefer` list. Otherwise the reader gets the graph tools and the grep tools with contradictory policy rules stacked on top of each other, and nothing errors. Unit tests in `tests/unit/fragments/` enforce both halves of this.

## Each tier carries its own policy, not just a tool list

The thing that makes tiers safe is that each fragment ships the rules governing its own tools. The rules are different per tier because the tools are different in kind.

At Tier 1, a zero result is authoritative:

> 0 affected nodes AND 0 affected flows means self-contained. Report "no impact" and stop. Do not text-search, because Tier 1 already saw every reference.

At Tier 3, the opposite rule applies:

> Text search IS the absence check at this tier. No matches after one synonym retry means absent.

Tier 1 also carries a call budget (at most two Tier 1 calls per question, not counting one coverage check per session) and a retry protocol for empty results, because private, very recent, or unindexed symbols legitimately return nothing. Tier 3 carries the opposite discipline: always pass `path` to `Grep`, and re-grep the old name after a multi-file rename, because there is no reference-aware rename or safe delete at that tier.

There is no shared header fragment. Each tier file is self-contained, so a reader never receives half of one tier's policy and half of another's.

## Turning tiers on

Injection is driven by the `features` block in `.bdk/settings.json`:

```json
{
  "features": {
    "code-review-graph": true,
    "serena": true
  }
}
```

A condition such as `features.code-review-graph` is satisfied only when the key is present and `true`. An absent flag means that tier is not injected and the chain falls through. `/bdk:setup` writes these flags for you; see [Setup](../getting-started/setup.md) and [Settings](../reference/settings.md).

## Both servers need `uvx`

Serena and `code-review-graph` are both launched by `uvx` from BDK's plugin manifest. Without `uvx` on `PATH` neither server starts, so a `SessionStart` hook prints:

```
[BDK] WARNING: uvx not found. MCP tools (serena, code-review-graph) require uvx. Install: https://docs.astral.sh/uv/getting-started/installation/
```

Fix it and the tiers light up; ignore it and everything still works at Tier 3. See [Troubleshooting](../troubleshooting.md).

## Repo registration for the graph

A second `SessionStart` hook registers the current working directory with the graph's multi-repo registry. The server auto-detects the active repo from its host process, but the registry that powers cross-repo search and stable cross-session lookups stays empty until each project is registered once. Registration is idempotent, so running it on every session start is safe, and it is skipped silently when `.bdk/settings.json` is absent, when `features.code-review-graph` is explicitly `false`, or when `uvx` is missing.

!!! note
    Graph and Serena tools are scoped to the session's working directory. Asking about code outside the cwd falls through to text search by design, not by failure.

## Naming

Inside prompts and frontmatter, BDK always writes MCP tools in their plugin-namespaced form, for example `mcp__plugin_bdk_code-review-graph__get_impact_radius_tool` and `mcp__plugin_bdk_serena__find_symbol`. The unprefixed `mcp__serena__*` form is what you would see if you had configured the server yourself at user level; it does not resolve for a server shipped inside a plugin.

The same tier fragments reach subagents through preloaded meta-skills rather than the session hook, which is covered in [The shared foundation](shared-foundation.md).
