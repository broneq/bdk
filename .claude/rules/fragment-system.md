# Fragment System

BDK's conditional injection system: how fragments are structured and how dynamic content reaches skills and agents.

## What Are Fragments

Fragments are Markdown files injected at skill load time based on `.bdk/settings.json` feature flags. Unlike `references/` (always loaded), fragments are **only included** when their condition matches.

## Directory Layout

```
fragments/
  <capability>/        <- shared, multi-skill (e.g. decision-tier/)
    lavish.md

skills/<skill-name>/
  fragments/           <- skill-local conditional fragments
    react.md
    typescript-strict.md
```

A fragment is injected with one `inject.py --if` call (`--prefer` to suppress it when a better variant applies). There is no chain or tier mechanism. Syntax and placement are in `.claude/rules/inject-fragments.md`.

Each fragment is self-contained: it carries everything the reader needs, with no shared header file.

## Agents vs Skills

Agent `.md` files are static markdown — shell commands do not execute at load time, and the `hooks:`, `mcpServers:`, and `permissionMode:` frontmatter fields are **stripped** when an agent ships in a plugin (verbatim from the Claude Code agents reference: *"For security reasons, plugin subagents do not support the `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. These fields are ignored when loading agents from a plugin."*). `inject.py` cannot be used directly inside an agent file.

Dynamic content reaches agents one way instead: **`skills:` frontmatter on the agent** preloads named meta-skills (e.g. `bdk-rules-code-quality`, `bdk-test-tools`) into the subagent's startup context. The skill bodies contain `!`...`` blocks that resolve at preload time.

`STARTUP_INSTRUCTIONS.md` is static: the SessionStart hook prints it as is, so a `!`...`` block or marker in it would reach the model unresolved. The **orchestrator** session sees it; subagents do **not** inherit it.

`skills:` is **not** in the plugin-restricted list — it is the supported substitute for the dead `hooks: SessionStart` pattern. See `docs/INJECTION-FLOWS.md` for the full audit and migration history.

## Naming Gotcha — Three `rules/` Directories

BDK has three distinct `rules/` locations. Do not confuse them:

| Path | Owner | Purpose |
|------|-------|---------|
| `rules/` (repo root) | BDK distributor | Language-agnostic rule files shipped to end-user projects (`code-quality.md`, `architecture.md`, `design-patterns.md`). Injected via `scripts/inject-rules.py`. |
| `.claude/rules/` (this dir) | BDK dev-time | Internal conventions for developing BDK itself (`fragment-system.md`, `portability-check.md`, etc.). Not distributed. |
| `<user-project>/.claude/rules/` | End-user project | Project-specific rules injected by Claude Code at session start. May collide in name with BDK's `rules/` if a user copies rule files in — treat as separate namespaces. |

When a user project installs BDK as a plugin, the plugin's `rules/` files are accessed via `${CLAUDE_PLUGIN_ROOT}/rules/` (explicit path). The user project's `.claude/rules/` is loaded by Claude Code automatically and is a separate namespace — no collision at runtime, but the similar names can confuse contributors. Always use the full path (`${CLAUDE_PLUGIN_ROOT}/rules/`) when referencing BDK rules from scripts or skill inject calls.
