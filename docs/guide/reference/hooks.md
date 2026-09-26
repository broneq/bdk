# Hooks reference

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

BDK registers hooks via `hooks/hooks.json`. This page lists every entry in file order: the event it fires on, what it runs, what it prints (quoted from the script), and when it blocks the session.

Every hook script here is invoked as `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/<name>/<script>` (or a plain shell one-liner) and each hooks block in `hooks.json` groups the entries that fire together on that event.

## SessionStart

Three hooks fire in this order at the start of (or resume of) every session.

### 1. `STARTUP_INSTRUCTIONS.md` (inline shell)

Command: `cat "${CLAUDE_PLUGIN_ROOT}/STARTUP_INSTRUCTIONS.md"`

Prints the shared foundation as is, so it becomes session context. The file is static: Claude Code evaluates dynamic `` !`...` `` blocks only in skill bodies, never in hook output. Never blocks.

### 2. `hooks/check-rules-drift/check.py --snapshot-baseline`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/check-rules-drift/check.py --snapshot-baseline`

Seeds `.bdk/tmp/.rules_drift/drift-<session_id>.json` with content fingerprints of any `.claude/rules/*.md`-matched files already dirty at session start, so those pre-existing edits are never reported as drift caused by this session. Never overwrites an existing cursor for the same `session_id` (SessionStart also fires on resume). Silent on success; never blocks - it only writes state.

### 3. `bdk config check` (inline shell)

Command: `test -d .bdk && node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config check 2>&1 || true`

Runs only in a project that has a `.bdk/` directory. Validates the project settings against the kernel's schema and prints any error or warning it finds, including a `legacy-settings` warning when a `.bdk/settings.json` is present but no longer read. See the [README](https://github.com/broneq/bdk/blob/main/README.md#settings). The trailing `|| true` means it never blocks the session.

## Stop

One hook fires when Claude finishes a turn.

### 1. `hooks/check-rules-drift/check.py`

Command: `python3 ${CLAUDE_PLUGIN_ROOT}/hooks/check-rules-drift/check.py`

Re-fingerprints every file matched by a path-scoped `.claude/rules/*.md` frontmatter `paths:` list, compares against the session's stored cursor, and blocks with `decision: block` when any matched file changed content since the last Stop hook run this session. See [Troubleshooting](../troubleshooting.md) for the full block message text. Advances its cursor on every run - including a run that stays silent - before deciding anything, and skips deciding (but still records) when `stop_hook_active` is true (prevents an infinite block loop within one turn).

## Other hook scripts (not wired into `hooks.json`)

Two more scripts live under `hooks/` but are not part of the always-on `hooks.json` chain above - they are invoked from individual skills' own `hooks:` frontmatter instead (see `.claude/rules/skills.md`):

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
