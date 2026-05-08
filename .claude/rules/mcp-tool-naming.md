# MCP Tool Naming — Plugin-Namespaced Prefix

BDK ships as a Claude Code plugin. MCP servers declared in the plugin's `.mcp.json` are namespaced under the plugin name when loaded into a session. All references to MCP tools — in agent `tools:` lists, skill `allowed-tools:` frontmatter, and prose inside SKILL.md / agent.md bodies — MUST use the namespaced form.

## The Rule

```
mcp__plugin_bdk_<server-name>__<tool-name>
```

- **`mcp__`** — fixed prefix Claude Code applies to every MCP-provided tool.
- **`plugin_bdk_`** — `plugin_<plugin-name>_` segment, present because the MCP server ships inside a plugin (`bdk` here).
- **`<server-name>`** — server name as declared in `.mcp.json` (e.g. `serena`, `code-review-graph`).
- **`<tool-name>`** — tool name as exposed by the server.

## Examples

| Server | Tool | Correct name |
|---|---|---|
| `serena` | `activate_project` | `mcp__plugin_bdk_serena__activate_project` |
| `serena` | `find_symbol` | `mcp__plugin_bdk_serena__find_symbol` |
| `code-review-graph` | `build_or_update_graph_tool` | `mcp__plugin_bdk_code-review-graph__build_or_update_graph_tool` |
| `code-review-graph` | `query_graph_tool` | `mcp__plugin_bdk_code-review-graph__query_graph_tool` |

Hyphens inside server names (e.g. `code-review-graph`) are preserved verbatim — do not convert to underscores.

## Common Mistake

```yaml
# WRONG — drops the plugin namespace, will not resolve at runtime
allowed-tools: mcp__serena__activate_project

# RIGHT
allowed-tools: mcp__plugin_bdk_serena__activate_project
```

The unprefixed form (`mcp__serena__*`, `mcp__code-review-graph__*`) is what tools look like when the MCP server is configured at the **user** level (`~/.claude/mcp.json`) — not as a plugin. Inside BDK we always use plugin form because BDK ships its MCP servers via plugin manifest.

## Where the rule applies

| Location | Form |
|---|---|
| Agent frontmatter `tools:` list | `mcp__plugin_bdk_<server>__<tool>` |
| Skill frontmatter `allowed-tools:` | `mcp__plugin_bdk_<server>__<tool>` |
| SKILL.md / agent.md body prose | `mcp__plugin_bdk_<server>__<tool>` |
| Tool-tier fragments under `fragments/tool-tiers/` | `mcp__plugin_bdk_<server>__<tool>` |
| Hook scripts that invoke MCP tools | `mcp__plugin_bdk_<server>__<tool>` |

## Wildcard form in `allowed-tools`

Skills that bootstrap or coordinate MCP servers (e.g. `setup`) should grant access to the entire plugin namespace rather than listing every tool by name:

```yaml
allowed-tools: Read Bash Write mcp__plugin_bdk_*
```

The `*` glob matches every tool from every BDK-bundled MCP server. Use this when:
- The skill doesn't know in advance which MCP tools it needs (setup, diagnostic, lifecycle skills)
- Listing every tool would be brittle (new servers added later silently prompt for permission)
- Typos in long tool names would cause silent failure

For narrow-purpose skills/agents (one or two specific MCP calls), prefer explicit names — they document intent and limit blast radius.

## Verifying the actual prefix

Open the deferred-tool list in any session — the **system reminder** at session start lists every tool by exact name. Search for `serena` or `code-review-graph` and copy the prefix verbatim.

## Enforcement

`/bdk:skill-lint` and `/bdk:agent-lint` should flag any `mcp__<server>__*` reference that omits the `plugin_bdk_` segment.
