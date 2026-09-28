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

## PreToolUse

One guard hook fires before every `Bash`, `Edit`, `Write`, `NotebookEdit` and `Agent` tool call (matcher `^(Bash|Edit|Write|NotebookEdit|Agent)$`).

### `hooks/guard/pre-tool.sh`

Command: `f="${CLAUDE_PLUGIN_ROOT}/hooks/guard/pre-tool.sh"; [ -r "$f" ] || { echo "guard/kernel-unavailable: $f is missing, so BDK cannot check this tool call; reinstall the BDK plugin" >&2; exit 2; }; . "$f"`

The script is sourced into the host's shell. A shell prefilter drops every payload no guard can deny (no `.bdk/specs`, no `bdk.mjs ... hooks`, no BDK adapter, no subagent `git` or `bdk.mjs`), so most tool calls never start Node. The rest go to `bdk hooks pre-tool`, which reads the Bash command with a shell lexer and applies these guards in order; the first match denies:

| Rule                            | Denies                                                                                                                                                                                                               | Threads   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `guard/spec-dir-write`          | an edit tool or a Bash write under `.bdk/specs/`, which only `bdk spec merge` writes at close                                                                                                                        | all       |
| `guard/hooks-from-bash`         | running a `bdk hooks ...` command from Bash                                                                                                                                                                          | all       |
| `guard/nested-stage-command`    | `claude` with `/bdk:plan`, `/bdk:execute`, `/bdk:close` or `/bdk:run`, which would type the stage command as the user                                                                                                | all       |
| `guard/subagent-git`            | `git stash`, `reset`, `clean`, `restore`, `commit`, `add`, `merge`, `rebase`, `cherry-pick`, `push`, a discarding `checkout` or `switch`                                                                             | subagents |
| `guard/subagent-kernel-command` | a kernel command of the `orchestrator` class (`bdk commit`, `bdk done`, ...)                                                                                                                                         | subagents |
| `guard/reader-write`            | a Bash write from the read-only adapters `bdk:reader`, `bdk:reviewer` and `bdk:scout`                                                                                                                                | subagents |
| `guard/dispatch-prompt`         | an `Agent` call to a BDK adapter (`bdk:worker`, `bdk:reader`, `bdk:reviewer`, `bdk:runner`, `bdk:scout`) whose prompt is not one dispatch package path under `.bdk/changes/<id>/dispatch/` plus at most one sentence | all       |

A denied call exits 2 with the host's `permissionDecision: deny` JSON on stdout and `<rule>: <reason>` on stderr; the reason tells the model what to do instead. Main-thread git and main-thread orchestrator commands always pass. The hook decides outside a git repository too, so a subagent's `git init` in an empty directory passes.

The guard fails closed: when Node is not on `PATH` or `dist/bdk.mjs` is missing, a payload the prefilter keeps is blocked with `guard/kernel-unavailable`. A dropped payload still passes without Node.

Known gaps: the guards stop a careless model, not a deliberate one. Your own `!` bash-mode commands never reach `PreToolUse`, and a command hidden in an interpreter (`python -c`, `node -e`), a script file, an alias or a function is not read.

## UserPromptExpansion

One gate hook fires when you type a stage command (matcher `^bdk:(plan|execute|close|run)$`).

### `hooks/guard/prompt-expansion.sh`

Command: the `pre-tool.sh` form above with `prompt-expansion.sh` and "the stage gate". The script runs `bdk hooks prompt-expansion`, and fails closed with `guard/kernel-unavailable` without Node or the bundle.

Typing the command is how you pass a gate: only a payload with the host's user-typed marker (`expansion_type: slash_command` and a `session_id`) writes, so the model cannot pass a gate by itself.

| You type                                             | BDK does                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:plan` or `/bdk:close` with its gate ready      | writes a `transition` entry with `source: user`, the session and the command, prints `[BDK] gate:<name> passed by the user in <entry>; stage <stage> is open.` |
| a stage command whose gate is not ready              | blocks with `policy/gate-not-ready: <gate> is not ready for /bdk:<command>: <requirement> is <state>, ...` and writes nothing                                  |
| a stage command whose gate is already passed         | writes nothing and prints when it was passed                                                                                                                   |
| a stage command without a gate (`/bdk:execute`)      | writes a plain `transition`; `/bdk:execute --skip-verify` records `skip-verify: true`                                                                          |
| `/bdk:run`                                           | passes each ready gate set to `auto` in `policy.gates` with a `source: policy` entry, and names the `manual` gates you still type                              |
| a stage command on a branch without an active Change | blocks with `policy/no-active-change`                                                                                                                          |

Every other command, BDK or not, passes untouched. The host fires this hook only for an installed command, and the `plan`, `execute`, `close` and `run` skills are still being written (T41), so until they ship no gate passes this way.

## SessionEnd

One hook fires when a session ends: `/clear`, `/exit`, a terminated process and the end of every headless run. It never fires after a SIGKILL.

### `bdk hooks session-end`

Command: `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-end 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Commits a checkpoint of the active Change directory, as `bdk change checkpoint` does, when `policy.checkpoint.enabled` is on, and prints `[BDK] checkpoint <sha7> of <change>`. Without an active Change, with nothing to commit, during a rebase, merge or cherry-pick, or with a ticket still open, it skips silently. It never blocks.

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
