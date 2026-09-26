# Hooks reference

BDK registers hooks via `hooks/hooks.json`. This page lists every entry in file order: the event it fires on, what it runs, what it prints (quoted from the script), and when it blocks the session.

Every hook script here is invoked as `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/<name>/<script>` (or a plain shell one-liner) and each hooks block in `hooks.json` groups the entries that fire together on that event.

## SessionStart

Six hooks fire in this order at the start of (or resume of) every session.

### 1. `scripts/render_startup.py`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/render_startup.py`

Renders `STARTUP_INSTRUCTIONS.md` with its `<!-- CHAIN: ... -->` markers expanded against `.bdk/settings.json`, and prints the result to stdout so it becomes session context. Per its own docstring:

```
Replaces dead Flow 2 from docs/contributing/injection-flows.md: the SessionStart hook
used to `cat` STARTUP_INSTRUCTIONS.md, but the !-blocks inside it never
re-evaluate -- Claude Code's dynamic-injection only runs in skill bodies,
not in hook stdout. This script does the substitution itself before the
hook returns, so chain content reaches the model.
```

When `.bdk/settings.json` is missing, chain markers expand to empty strings but the file is still emitted, so the prose-only sections still reach the model. Never blocks.

### 2. `uvx` presence check (inline shell)

Command:

```
command -v uvx >/dev/null 2>&1 || echo '[BDK] WARNING: uvx not found. MCP tools (serena, code-review-graph) require uvx. Install: https://docs.astral.sh/uv/getting-started/installation/'
```

Printed message when `uvx` is not on `PATH`:

```
[BDK] WARNING: uvx not found. MCP tools (serena, code-review-graph) require uvx. Install: https://docs.astral.sh/uv/getting-started/installation/
```

Prints nothing when `uvx` is present. Never blocks - a warning only. See [Installation](../getting-started/installation.md) and [Troubleshooting](../troubleshooting.md).

### 3. `code-review-graph status` (inline shell)

Command:

```
command -v uvx >/dev/null 2>&1 && uvx code-review-graph status || true
```

Runs only when `uvx` is present; prints whatever `code-review-graph status` itself outputs (an external tool - its exact text is not part of this repo's sources). The trailing `|| true` means a failing status check never blocks the session.

### 4. `hooks/check-rules-drift/check.py --snapshot-baseline`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/check-rules-drift/check.py --snapshot-baseline`

Seeds `.bdk/tmp/.rules_drift/drift-<session_id>.json` with content fingerprints of any `.claude/rules/*.md`-matched files already dirty at session start, so those pre-existing edits are never reported as drift caused by this session. Never overwrites an existing cursor for the same `session_id` (SessionStart also fires on resume). Silent on success; never blocks - it only writes state.

### 5. `hooks/check-bdk-config/check.py`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/check-bdk-config/check.py`

Reads `.bdk/settings.json` and either prints a compact settings summary or blocks the session. See [Troubleshooting](../troubleshooting.md) for the exact block messages and [Settings reference](settings.md) for the schema it validates against.

On success it prints (format from `format_settings_context`):

```
---
## BDK Project Settings (.bdk/settings.json)

Languages: <languages>
Test commands: <command> (<type>, <tier>), ...
Lint commands: <command> (<type>, <tier>), ...
Build commands: <command> (<type>), ...
Features: <key>=on|off, ...
```

(each line only appears when that key is present in settings). This is the **only** hook in this list that can emit `{"decision": "block", ...}` under normal conditions (see troubleshooting).

### 6. `hooks/register-graph-repo/register.py`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/register-graph-repo/register.py`

Registers the current working directory in the `code-review-graph` multi-repo registry via `uvx code-review-graph register <path> --alias <dirname>`, so `cross_repo_search_tool` and cross-session lookups work. Per its docstring, it is:

```
Silent (exit 0, no output) on success. Prints a one-line warning if the
CLI is missing or registration fails.
```

and is skipped silently when:

```
- .bdk/settings.json missing (project not configured for BDK)
- features.code-review-graph explicitly false
- uvx not on PATH
```

Failure message format (first line of the failed subprocess's stderr/stdout):

```
[BDK] code-review-graph register failed: <first line>
```

or, if the subprocess itself could not start / timed out:

```
[BDK] code-review-graph register failed: <exception>
```

Never blocks the session either way.

## Stop

Two hooks fire when Claude finishes a turn.

### 1. `hooks/check-rules-drift/check.py`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/check-rules-drift/check.py`

Re-fingerprints every file matched by a path-scoped `.claude/rules/*.md` frontmatter `paths:` list, compares against the session's stored cursor, and blocks with `decision: block` when any matched file changed content since the last Stop hook run this session. See [Troubleshooting](../troubleshooting.md) for the full block message text. Advances its cursor on every run - including a run that stays silent - before deciding anything, and skips deciding (but still records) when `stop_hook_active` is true (prevents an infinite block loop within one turn).

### 2. `code-review-graph update` (inline shell)

Command:

```
command -v uvx >/dev/null 2>&1 && uvx code-review-graph update || true
```

Runs only when `uvx` is present; keeps the knowledge graph incrementally current after each turn. `|| true` means it never blocks the session.

## Other hook scripts (not wired into `hooks.json`)

Two more scripts live under `hooks/` but are not part of the always-on `hooks.json` chain above - they are invoked from individual skills' own `hooks:` frontmatter instead (see `.claude/rules/skill-creation-rules.md`):

### `hooks/is-skill-exist/check.py`

Usage: `check.py <skill-name>`, run as a `UserPromptSubmit` hook from a skill's own frontmatter (for example `skills/commit/SKILL.md` checks for `caveman-commit`). Searches `~/.claude/skills/`, `.claude/skills/`, and every installed plugin's `skills/` directory for a skill whose frontmatter `name:` matches. Warning message (to stderr, exit code 2) when not found:

```
[BDK] Skill '<skill-name>' not installed. Install it for full functionality. Expected location: ~/.claude/skills/ or .claude/skills/
```

Silent, exit 0, when the skill is found. See [Troubleshooting](../troubleshooting.md).

### `hooks/is-command-exists/check.py`

Usage: `check.py <command> [install-hint]`. Checks `shutil.which(command)`. Warning message (to stderr, exit code 2) when missing:

```
[BDK] Command '<command>' not found in PATH. This skill requires it to be installed.
```

with `" Install: <install-hint>"` appended when an install hint argument was given. Silent, exit 0, when the command is found.
