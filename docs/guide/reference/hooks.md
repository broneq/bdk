# Hooks reference

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

BDK registers hooks via `hooks/hooks.json`. This page lists every entry: the event it fires on, what it runs, what it prints, and when it blocks the session.

## SessionStart

One hook fires at the start (or resume) of every session.

### `bdk hooks session-start`

Command: `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Prints the shared foundation (`STARTUP_INSTRUCTIONS.md`, byte-identical to `bdk ctx startup`) so it becomes session context. In a project with a `.bdk/` directory it then validates the settings as `bdk config check` does, which also refreshes `.bdk/.machine/`, and appends one line per problem:

```
[BDK] config: <why> Instead: <what to do>
[BDK] config warning: <path>: <message>
[BDK] v2 layout detected (<paths>): run bdk import.
```

A configuration problem is session content, never a block: the hook always exits 0. Without Node on `PATH` the `echo` fallback prints the `BDK STOP: kernel unavailable` line instead.

BDK registers no `Stop` hook.

## Skill frontmatter hooks

A skill that delegates to another plugin's skill checks for it with its own `UserPromptSubmit` hook (see `.claude/rules/skills.md`).

### `bdk hooks skill-exists <name>`

Command (from `skills/commit/SKILL.md`, which needs `caveman-commit`): `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks skill-exists caveman-commit 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`, with `once: true`.

Searches `~/.claude/skills/`, `.claude/skills/`, every marketplace under `~/.claude/plugins/marketplaces/` and every installed plugin version under `~/.claude/plugins/cache/` for a `SKILL.md` whose frontmatter `name:` matches. Silent when found. When not found it prints one line and exits 0:

```
[BDK] skill <name> is not installed; the skill that needs it falls back to its own behaviour.
```

See [Troubleshooting](../troubleshooting.md).

## Other hook scripts (not wired into `hooks.json`)

One more script lives under `hooks/` but is not wired into `hooks.json` or any skill:

### `hooks/is-command-exists/check.py`

Usage: `check.py <command> [install-hint]`. Checks `shutil.which(command)`. Warning message (to stderr, exit code 2) when missing:

```
[BDK] Command '<command>' not found in PATH. This skill requires it to be installed.
```

with `" Install: <install-hint>"` appended when an install hint argument was given. Silent, exit 0, when the command is found.
