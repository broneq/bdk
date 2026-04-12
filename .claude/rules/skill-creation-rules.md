---
description: Conventions for skill frontmatter fields and hooks inside skills
paths:
  - ".claude/skills/**"
  - "skills/**"
---

# Skill Creation Rules

## Frontmatter Reference

All fields optional except `description` (recommended).

| Field | Description |
|-------|-------------| 
| `name` | Slash-command name. Lowercase, hyphens only, max 64 chars. Defaults to directory name. |
| `description` | When to use the skill. Front-load use case. Max 250 chars. |
| `argument-hint` | Autocomplete hint for args. Example: `[issue-number]` or `[filename] [format]`. |
| `disable-model-invocation` | `true` = user-only (not Claude). Use for `/commit`, `/deploy`, etc. |
| `user-invocable` | `false` = hidden from `/` menu. Claude-only background knowledge. |
| `allowed-tools` | Tools auto-approved when skill active. Space-separated or YAML list. |
| `model` | Model override. |
| `effort` | `low` / `medium` / `high` / `max` (Opus only). Overrides session effort. |
| `context` | `fork` = isolated subagent. |
| `agent` | Subagent type when `context: fork`. Options: `Explore`, `Plan`, `general-purpose`, or custom. |
| `hooks` | Skill-scoped hooks. See below. |
| `paths` | Glob patterns — auto-activate when working with matching files. |
| `shell` | `bash` (default) or `powershell`. |

**Wrong:** `arguments:` field does not exist. Use `argument-hint:` for autocomplete hints.

### Invocation matrix

| Frontmatter | User invoke | Claude invoke | When loaded |
|-------------|-------------|---------------|-------------|
| (default) | Yes | Yes | Description always in context |
| `disable-model-invocation: true` | Yes | No | Not in context until user invokes |
| `user-invocable: false` | No | Yes | Description always in context |

### String substitutions in skill content

| Variable | Value |
|----------|-------|
| `$ARGUMENTS` | Full argument string |
| `$ARGUMENTS[N]` / `$N` | Nth argument (0-based) |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_SKILL_DIR}` | Directory of the skill's SKILL.md |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin root (for plugin skills) |

## Full Frontmatter Example

```yaml
---
name: my-skill
description: What it does and when. Front-load key use case.
argument-hint: "[target] [format]"
disable-model-invocation: true
allowed-tools: Bash(git *) Read
model: haiku
context: fork
agent: Explore
hooks:
  UserPromptSubmit:
    - hooks:
        - type: command
          command: "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/is-skill-exist/check.py <dependency>"
          once: true
---
```

---

# Hooks in Skills

Skills declare hooks in YAML frontmatter. Hooks scoped to skill lifecycle — activate on start, cleanup on finish.

## Frontmatter Format

```yaml
---
name: my-skill
description: ...
hooks:
  UserPromptSubmit:
    - hooks:
        - type: command
          command: "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/is-skill-exist/check.py <skill-name>"
          once: true
---
```

## Supported Hook Events

All standard Claude Code hook events: `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, etc.
`Stop` auto-converts to `SubagentStop` inside agents.

## Key Fields

| Field | Notes |
|-------|-------|
| `matcher` | Filter by tool name pattern (e.g. `"Bash"`, `"Write\|Edit"`) |
| `type` | `command` / `http` / `prompt` / `agent` |
| `once` | `true` = fires once per session then removed. Skills only. |
| `timeout` | Override default timeout (seconds) |

## Skill Dependency Check Pattern

Use `hooks/is-skill-exist/check.py` to verify required skill at startup:

```yaml
hooks:
  UserPromptSubmit:
    - hooks:
        - type: command
          command: "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/is-skill-exist/check.py <dependency-skill-name>"
          once: true
```

- `once: true` — fires only on first prompt submit (skill invocation), not every turn
- Script searches `~/.claude/skills/` and `.claude/skills/` by frontmatter `name:` field
- Prints warning if skill not found; silent if found

## Rules

- Prefer `once: true` for startup checks — no repeated noise per turn
- Hook scripts live in `hooks/<hook-name>/` — not in `skills/`
- Skills reference plugin root via `${CLAUDE_PLUGIN_ROOT}` — no hardcoded paths
- Do not add hooks that duplicate global hooks in `hooks/hooks.json`
