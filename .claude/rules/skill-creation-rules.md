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
| `allowed-tools` | Tools auto-approved when skill active. Space-separated or YAML list. Supports glob patterns (e.g. `mcp__plugin_bdk_*` to grant access to all plugin-bundled MCP tools). For MCP tool naming convention see `.claude/rules/mcp-tool-naming.md`. **Pre-approval, not a whitelist** - a tool absent from this list still works, it just goes through the normal permission flow. |
| `disallowed-tools` | Tools **removed from the pool** while the skill is active - the only frontmatter field that restricts rather than pre-approves. Use it when a skill's prose states an invariant about what it must never call, so the invariant is enforced instead of requested: `AskUserQuestion` for an autonomous background skill, `Edit`/`NotebookEdit` for a read-only reviewer. Same accepted forms as `allowed-tools`. `/bdk:skill-lint` check 22 flags a stated invariant with no matching field. |
| `model` | Model override. |
| `effort` | `low` / `medium` / `high` / `xhigh` / `max`. Overrides session effort; which levels exist depends on the model. |
| `context` | `fork` = isolated subagent. |
| `agent` | Subagent type when `context: fork`. Options: `Explore`, `Plan`, `general-purpose`, or custom. |
| `hooks` | Skill-scoped hooks. See below. |
| `paths` | Glob patterns — auto-activate when working with matching files. |
| `shell` | `bash` (default) or `powershell`. |

**Wrong:** `arguments:` field does not exist. Use `argument-hint:` for autocomplete hints.

**If the skill body runs a `!`...`` block against `${CLAUDE_PLUGIN_ROOT}/scripts/`:** add `allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)`. `${CLAUDE_PLUGIN_ROOT}` resolves inside `allowed-tools` Bash rules the same way it does in skill body content, so the rule stays correct wherever the plugin is installed. This pre-approves the call instead of leaving it to be decided fresh each time, which matters most for `user-invocable: false` meta-skills preloaded into background subagents.

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

---

# Conditional Content Injection

Skills and agents can conditionally include content based on `.bdk/settings.json` using the native `!`command`` shell injection syntax. Runs at skill load time — deterministic, works for both user and agent invocation.

## Tool

`scripts/inject.py` — evaluates conditions against `.bdk/settings.json`, prints file content or text if all conditions true, silent otherwise.

## Syntax

```md
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if <condition> --then ${CLAUDE_SKILL_DIR}/file.md`
```

Multiple `--if` = AND logic. Use `--then-text` for inline text instead of a file.

## Condition Syntax

| Condition | True when |
|-----------|-----------|
| `features.react` | `settings.features.react == true` |
| `features.code-review-graph` | `settings.features.code-review-graph == true` |
| `languages[typescript]` | `"typescript" in settings.languages` |
| `tool.lavish-axi` | an executable named `lavish-axi` is on `PATH` |

The dotted spelling of `tool.` is the only accepted one. `tool[name]` is parsed by the array rule as a
lookup in a nonexistent `tool` list and silently evaluates false - it never errors, so the condition
reads as "tool absent" forever. Pair `tool.<binary>` with the matching `features.<flag>`: the flag says
the user wants it, the probe says the machine has it.


## Examples

```md
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.react --then ${CLAUDE_SKILL_DIR}/fragments/react.md`

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.react --if languages[typescript] --then ${CLAUDE_SKILL_DIR}/fragments/react-ts.md`

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.code-review-graph --then-text "Run detect_changes first for risk scoring."`
```

## Rules

- Put conditional fragments in `fragments/` subdir of the skill — see `.claude/rules/inject-fragments.md`
- Use `--then-text` only for short snippets (1-2 lines); use `--then` + file for anything longer
- Missing `.bdk/settings.json` = silent (exit 0) — graceful for projects not using BDK
- A **false** condition is silent; a **broken** one is not. Unknown condition syntax, a missing `--then`
  file, or a bad chain prints `[bdk-inject-error] <desc>` to **stdout** and still exits 0. That is
  deliberate: a `!`...`` block captures stdout only and ignores the exit code, so stderr + exit 1 would
  render a broken injection as an empty one. Same contract in `inject-rules.py` and
  `inject-language-rules.py`; `render_startup.py` is exempt because it runs from a hook, where stderr
  is visible.
- Settings file searched upward from cwd — no need to specify path in skills

## Programmatic API

```python
from scripts.inject import load_settings, evaluate_condition, inject

settings = load_settings()                                    # dict | None
ok = evaluate_condition("features.react", settings)           # bool
content = inject(["features.react"], then_path="react.md", settings=settings)  # str
```

# Dispatching Subagents From a Skill

- The `Agent` tool takes only `subagent_type`, `prompt`, `description`, `model`, `isolation`. There is no `run_in_background` (that is a `Bash` field). Naming a parameter the tool does not have is an input-validation error at user runtime; BDK's own tests never execute a skill body, so nothing here catches it.
- Subagents already run in the background and the harness notifies the orchestrator on completion. A skill that says "wait for still-running agents" without saying how invites the orchestrator to invent a poll - `ScheduleWakeup` (valid only in `/loop` dynamic mode), `Monitor`, `sleep`, or a watcher agent. When a step waits, say explicitly: wait for the completion notification, do not poll.
