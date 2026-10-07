# Hooks reference

BDK registers hooks via `hooks/hooks.json`. This page lists every entry: the event it fires on, what it runs, what it prints, and when it blocks the session.

## SessionStart

One hook fires at the start (or resume) of every session.

### `bdk hooks session-start`

Command: `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Prints the shared foundation (`STARTUP_INSTRUCTIONS.md`, byte-identical to `bdk ctx startup`) so it becomes session context. In a project with a `.bdk/` directory it then validates the settings as `bdk config check` does, which also refreshes `.bdk/.machine/`, and appends one line per problem:

```
[BDK] WARNING: .bdk/.prettierrc is missing or is not the BDK formatter guard, ...
[BDK] config: <why> Instead: <what to do>
[BDK] config warning: <path>: <message>
[BDK] v2 layout detected (<paths>): run /bdk:setup.
```

The `WARNING` line comes first. It appears when `.bdk/.prettierrc` is missing or is not the formatter guard (see [Troubleshooting](../troubleshooting.md#prettier-rewrites-files-under-bdk)), and it names the exact content to restore. The hook never writes the file itself.

It also ends, as `stale`, the agents of other sessions that have been silent for longer than `agents.ttl`, so a crashed session leaves no agent `running` in the agent registry (see [Agent hooks](#agent-hooks)).

A configuration problem is session content, never a block: the hook always exits 0. Without Node on `PATH` the `echo` fallback prints the `BDK STOP: kernel unavailable` line instead.

## PreToolUse

One guard hook fires before every tool call (no matcher), because the heartbeat must see every tool of a subagent.

### `hooks/guard/pre-tool.sh`

Command: `f="${CLAUDE_PLUGIN_ROOT}/hooks/guard/pre-tool.sh"; [ -r "$f" ] || { echo "guard/kernel-unavailable: $f is missing, so BDK cannot check this tool call; reinstall the BDK plugin" >&2; exit 2; }; . "$f"`

The script is sourced into the host's shell. For a subagent's call it first writes `open` to `.bdk/.machine/agents/<agent_id>`, the heartbeat, in the shell. A shell prefilter then drops every payload no guard can deny (no `.bdk/specs`, no `bdk.mjs ... hooks` or `bdk ... hooks`, no BDK adapter, no subagent `git`, `bdk.mjs` or `bdk `, no `SendMessage`, no `Skill` call to a stage skill, no main-thread edit while `.bdk/.machine/review-round` exists), so most tool calls never start Node. The rest go to `bdk hooks pre-tool`, which reads the Bash command with a shell lexer and applies these guards in order; the first match denies:

| Rule                            | Denies                                                                                                                                                                                                                                      | Threads   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `guard/spec-dir-write`          | an edit tool or a Bash write under `.bdk/specs/`, which only `bdk spec merge` writes at close                                                                                                                                               | all       |
| `guard/hooks-from-bash`         | running a `bdk hooks ...` command from Bash                                                                                                                                                                                                 | all       |
| `guard/nested-stage-command`    | `claude` with `/bdk:plan`, `/bdk:execute`, `/bdk:close` or `/bdk:run`, which would type the stage command as the user                                                                                                                       | all       |
| `guard/subagent-git`            | `git stash`, `reset`, `clean`, `restore`, `commit`, `add`, `merge`, `rebase`, `cherry-pick`, `push`, a discarding `checkout` or `switch`                                                                                                    | subagents |
| `guard/subagent-kernel-command` | a kernel command of the `orchestrator` class (`bdk commit`, `bdk done`, ...); a `bdk:judge` may run `log triage`                                                                                                                            | subagents |
| `guard/judge-scope`             | a `bdk:judge` running `log triage` on an entry its package does not list, or with no package in the agent registry                                                                                                                          | judges    |
| `guard/worktree-scope`          | an edit tool outside the work root of a subagent whose package names a worktree                                                                                                                                                             | subagents |
| `guard/reader-write`            | a Bash write from the read-only adapters `bdk:reader`, `bdk:integrator`, `bdk:judge`, `bdk:reviewer` and `bdk:scout`                                                                                                                        | subagents |
| `guard/draft-only`              | an edit tool outside `.bdk/.machine/drafts/` from `bdk:reader`, `bdk:integrator`, `bdk:judge`, `bdk:reviewer`, `bdk:scout` or `bdk:runner`, or from the main thread while a review round's ticket is open                                   | all       |
| `guard/dispatch-prompt`         | an `Agent` call to a BDK adapter (`bdk:worker`, `bdk:reader`, `bdk:integrator`, `bdk:judge`, `bdk:reviewer`, `bdk:runner`, `bdk:scout`) whose prompt is not one dispatch package path plus at most one sentence; a worker's scout is exempt | all       |
| `guard/agent-spawn`             | an agent starting a type it may not start: a worker starts scouts up to `agents.scout.max-per-ticket`, no other adapter starts agents                                                                                                       | subagents |
| `guard/escalation-model`        | an `Agent` call that starts the package of an escalation ticket without the `model` the package names                                                                                                                                       | all       |
| `guard/agent-message`           | a `SendMessage` that names no ledger entry of the Change, is longer than `agents.message.max-chars`, or goes to an agent that is not running                                                                                                | subagents |
| `guard/stage-skill`             | a `Skill` call to `bdk:change`, `bdk:plan`, `bdk:execute` or `bdk:close` from a subagent, from a session without a running `/bdk:run`, or a second `bdk:change` in one run                                                                  | all       |
| `guard/gate-manual`             | a run's `Skill` call to the stage behind a ready `manual` gate when the run has no `--auto`; the reason names the command you type                                                                                                          | main      |

An admitted `Skill` call to a stage skill enters the stage as typing its command would (see [UserPromptExpansion](#userpromptexpansion)), but a gate it passes is written with `source: policy` and your typed `/bdk:run` line as the command: by its `auto` policy, or with `auto: true` when only the run's `--auto` lets it pass. A gate that is not ready denies the call with `policy/gate-not-ready`.

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
| `/bdk:run "<intent>"` without an active Change       | starts a run for the session (`.bdk/.machine/runs/<session>.json`) and prints `[BDK] run started for the intent; no Change is active yet.`                     |
| `/bdk:run` with an active Change                     | starts a run and passes each ready gate set to `auto` in `policy.gates` with a `source: policy` entry; `--auto` as the first word passes every ready gate      |
| `/bdk:run "<intent>"` with an active Change          | blocks with `policy/change-exists`: finish or park the Change first                                                                                            |
| a stage command on a branch without an active Change | blocks with `policy/no-active-change`                                                                                                                          |

Every other command, BDK or not, passes untouched. Typing `/bdk:plan`, `/bdk:execute` or `/bdk:close` ends a run of the same session. To keep every gate yours, leave `policy.gates` at `manual` and run without `--auto`: the run then stops at each gate and names the command you type.

## SessionEnd

One hook fires when a session ends: `/clear`, `/exit`, a terminated process and the end of every headless run. It never fires after a SIGKILL.

### `bdk hooks session-end`

Command: `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-end 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Ends the session's `/bdk:run`, if one is running, then commits a checkpoint of the active Change directory, as `bdk change checkpoint` does, when `policy.checkpoint.enabled` is on, and prints `[BDK] checkpoint <sha7> of <change>`. Without an active Change, with nothing to commit, during a rebase, merge or cherry-pick, or with a ticket still open, it skips silently. It never blocks.

## Agent hooks

Five hooks keep the agent registry (`.bdk/.machine/agents.sqlite`), which `bdk agents list`, `show` and `wait` read. It records who started whom, which dispatch package each agent works on, and whether it still runs.

### `hooks/guard/post-tool.sh` (PostToolUse and PostToolUseFailure)

Command: the `pre-tool.sh` form above with `post-tool.sh` and "this agent", on both events, so a failed tool call moves the heartbeat too. For a subagent's call it writes `idle` to the heartbeat in the shell. It starts `bdk hooks post-tool` only in a BDK project and only for `Agent` (the parent links its child and the child's package) and `TaskStop` (an end).

### `bdk hooks subagent-start`, `subagent-stop` and `stop`

Command: `[ -d "${CLAUDE_PROJECT_DIR}/.bdk" ] || exit 0; node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks <verb> 2>/dev/null || exit 0`. These fire once per agent turn, not per tool call, and a missing kernel lets the event pass.

- `SubagentStart` completes the agent's row and gives a `bdk:` agent its identity: `BDK-AGENT-ID`, `BDK-PARENT`, `BDK-PACKAGE` and `BDK-TICKET` lines in its context.
- `SubagentStop` and `Stop` run the continuation check. A thread that ends its turn while its own scope holds work it can do now is sent back once more with a reason naming the work and the next command: the main thread while its stage has a ready artifact (`bdk next`), a worker while its report is not stored, a lead while a task of its part is open or not committed. An open question, a parked Change, a running background task, a non-BDK agent or a broken Change always lets the turn end. After `agents.continuation.max` sends without progress the check lets it end and writes a `finding` for review. A `SubagentStop` that passes ends the agent in the registry.

An agent that is cut off without a hook (`maxTurns`, a kill) turns `suspect` once its heartbeat is older than `agents.ttl`, or its open call older than `agents.open-call-limit`.

## Skill frontmatter hooks

A skill that delegates to another plugin's skill checks for it with its own `UserPromptSubmit` hook.

### `bdk hooks skill-exists <name>`

Command, in the frontmatter of a skill that needs another skill (no BDK skill declares one today; `<name>` is the needed skill): `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks skill-exists <name> 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`, with `once: true`.

Searches `~/.claude/skills/`, `.claude/skills/`, every marketplace under `~/.claude/plugins/marketplaces/` and every installed plugin version under `~/.claude/plugins/cache/` for a `SKILL.md` whose frontmatter `name:` matches. Silent when found. When not found it prints one line and exits 0:

```
[BDK] skill <name> is not installed; the skill that needs it falls back to its own behaviour.
```

See [Troubleshooting](../troubleshooting.md).
