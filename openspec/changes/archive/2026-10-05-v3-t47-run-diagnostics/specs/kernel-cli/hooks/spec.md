## MODIFIED Requirements

### Requirement: Guard hooks file and prefilter

`hooks/hooks.json` SHALL register the guards, the agent hooks, the tool-failure hook and the session-end hook as below, the `PreToolUse` and `PostToolUse` scripts SHALL write the heartbeat in the shell, and each SHALL start Node only when its shell prefilter finds the payload can be affected.

| Event                 | Matcher                             | Command                                                                                                                                                          |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse`          | none (every tool)                   | the guard form below with `pre-tool.sh`                                                                                                                          |
| `PostToolUse`         | none (every tool)                   | the guard form below with `post-tool.sh`                                                                                                                         |
| `PostToolUseFailure`  | none (every tool)                   | the guard form below with `post-tool.sh`                                                                                                                         |
| `SubagentStart`       | none                                | the agent form below with `subagent-start`                                                                                                                       |
| `SubagentStop`        | none                                | the agent form below with `subagent-stop`                                                                                                                        |
| `Stop`                | none                                | the agent form below with `stop`                                                                                                                                 |
| `UserPromptExpansion` | `^bdk:(plan\|execute\|close\|run)$` | the guard form below with `prompt-expansion.sh`                                                                                                                  |
| `SessionEnd`          | none                                | `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-end 2>&1 \|\| echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."` |

The guard form sources the script into the shell the host already starts, so a payload the prefilter drops costs no second process, and checks first that the script is readable, because a failing `.` ends some shells with exit 1, which the host would treat as a non-blocking error:

```sh
f="${CLAUDE_PLUGIN_ROOT}/hooks/guard/<script>"; [ -r "$f" ] || { echo "guard/kernel-unavailable: $f is missing, so BDK cannot check <what>; reinstall the BDK plugin" >&2; exit 2; }; . "$f"
```

The agent form runs the kernel directly, because these events fire once per agent turn, not per tool call, and never block a tool; a missing kernel lets the event pass:

```sh
[ -d "${CLAUDE_PROJECT_DIR}/.bdk" ] || exit 0; node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks <verb> 2>/dev/null || exit 0
```

`PreToolUse` and `PostToolUse` have no matcher because the heartbeat must see every tool of a subagent (`kernel-state`, Agent registry). The other matchers are anchored because the host tests a matcher with other characters than letters, digits, `_`, `-`, `|`, `,` and spaces as an unanchored regular expression (hooks reference, matchers). `MultiEdit` is left out: the host has no such tool (HOST-FACTS `input-multiedit`). The `Agent` matcher follows HOST-FACTS `agent-tool-name`.

Both guard scripts are POSIX `sh`, read the payload from stdin once, check before starting the kernel (in `pre-tool.sh` after the prefilter) that `node` is on `PATH` and `dist/bdk.mjs` exists (otherwise `guard/kernel-unavailable: ...` on stderr and exit 2), and end with one kernel line that matches the `guard-wrapper` regex of `kernel-cli`, Output modes, feeding the payload on stdin. **Heartbeat.** Before its prefilter, when the payload has `"agent_id"` and `${CLAUDE_PROJECT_DIR}/.bdk/.machine/` exists, `pre-tool.sh` writes `open` to `.bdk/.machine/agents/<agent_id>` and `post-tool.sh` writes `idle` to it, creating the directory when absent and taking the id from the payload only when it matches `^[A-Za-z0-9_-]+$`; a failed write never blocks the tool. Neither starts Node for it.

`pre-tool.sh` calls the kernel only when the raw payload contains one of: `.bdk/specs`; `bdk.mjs` and `hooks`; `/bdk:`; `"agent_id"` and either `git` or `bdk.mjs`; `bdk:reader`, `bdk:reviewer`, `bdk:scout` or `bdk:lead`; `"subagent_type"` and either `bdk:worker`, `bdk:runner` or `bdk:lead`; `SendMessage` or `Skill` as `tool_name`. Otherwise it exits 0 without starting Node. `post-tool.sh` serves both `PostToolUse` and `PostToolUseFailure`. It calls the kernel only when `.bdk/` exists and either `tool_name` is `Agent`, `TaskStop` or `AskUserQuestion`, or the verbose marker `.bdk/.machine/verbose` exists (`kernel-state`, Verbose log); with the marker, every payload reaches the kernel. The prefilter only over-approximates: whatever it lets through, the kernel decides from the parsed payload.

#### Scenario: hooks file entries

- **WHEN** `hooks/hooks.json` is inspected
- **THEN** it holds exactly the `SessionStart` entry of `plugin-tooling` and the eight entries above, and each guard script's kernel line matches `guard-wrapper`

#### Scenario: guard script missing

- **WHEN** `CLAUDE_PLUGIN_ROOT` points to a directory without `hooks/guard/` and a guard command runs
- **THEN** it exits 2 and stderr starts with `guard/kernel-unavailable`

#### Scenario: main-thread git without Node

- **WHEN** `pre-tool.sh` receives the recorded `pre-bash.json` payload with the command `git status` and no `node` on `PATH`
- **THEN** it exits 0 with empty stdout and never starts Node

#### Scenario: kernel removed

- **WHEN** `CLAUDE_PLUGIN_ROOT` points to a plugin without `dist/bdk.mjs` and `pre-tool.sh` receives a subagent `git commit -m x` or a main-thread `node .../bdk.mjs hooks pre-tool`
- **THEN** it exits 2 and stderr starts with `guard/kernel-unavailable`

#### Scenario: stage command without a kernel

- **WHEN** `prompt-expansion.sh` receives the recorded `upe-typed.json` payload with `command_name: bdk:plan` and no `dist/bdk.mjs`
- **THEN** it exits 2 and stderr starts with `guard/kernel-unavailable`

#### Scenario: heartbeat without Node

- **WHEN** `pre-tool.sh` receives a subagent `Read` payload with `agent_id: a1b2c3d4e5f6a7b8c` in a BDK project and no `node` on `PATH`
- **THEN** it exits 0 with empty stdout, `.bdk/.machine/agents/a1b2c3d4e5f6a7b8c` holds `open`, and `post-tool.sh` with the matching `PostToolUse` payload leaves it `idle`

#### Scenario: no heartbeat outside a BDK project

- **WHEN** `pre-tool.sh` receives the same payload in a project without `.bdk/`
- **THEN** it writes nothing

#### Scenario: agent hooks without a kernel

- **WHEN** `CLAUDE_PLUGIN_ROOT` points to a plugin without `dist/bdk.mjs` and a `Stop` or `SubagentStop` payload arrives
- **THEN** the hook exits 0 with no block, so the turn ends

#### Scenario: Skill reaches the kernel

- **WHEN** `pre-tool.sh` receives the recorded `pre-skill.json` payload
- **THEN** it starts the kernel, which decides the call

#### Scenario: post-tool without verbose skips ordinary tools

- **WHEN** `post-tool.sh` receives a `Read` payload in a BDK project without `.bdk/.machine/verbose` and no `node` on `PATH`
- **THEN** it exits 0 and never starts Node

#### Scenario: post-tool with verbose reaches the kernel

- **WHEN** `.bdk/.machine/verbose` exists and `post-tool.sh` receives a `Read` payload
- **THEN** it starts the kernel with the payload on stdin

## ADDED Requirements

### Requirement: Run journal and verbose lines of the hooks

The hooks SHALL append the journal lines below (`kernel-state`, Run journal), SHALL keep the verbose marker in step with `diagnostics.verbose`, and SHALL write the verbose live log only while the marker exists. A failure to write any of them SHALL NOT change a hook's output or exit code, and outside a BDK project nothing is written.

| Hook                                                   | Journal line                                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks session-start`                                  | `session`: `session` id, `transcript` (the payload's `transcript_path`), `source`, the BDK version and commit, the host version when the payload carries it |
| `hooks subagent-start`                                 | `agent-start`: `agent`, `type`, `parent`, `ticket`, `session`                                                                                               |
| `hooks subagent-stop`                                  | `agent-stop`: `agent`, `transcript` (`agent_transcript_path`), `by: subagent-stop`, `session`                                                               |
| `hooks post-tool` on `Agent` (completed) or `TaskStop` | `agent-stop` with `by: agent-result` or `by: task-stop` and `transcript: null` unless the payload carries one                                               |
| `hooks post-tool` on `AskUserQuestion`                 | `question`: `agent` (or `main`), the number of questions, `session`                                                                                         |
| `hooks pre-tool` on a block                            | the `command` line of `kernel-cli`, Run journal, plus `agent` (the payload's `agent_id`, or `main`) and `kind: guard`                                       |

**Verbose marker.** `hooks session-start` resolves `diagnostics.verbose`; when it is true the hook creates `.bdk/.machine/verbose`, otherwise it removes it. A settings file that does not resolve removes the marker.

**Live line.** While the marker exists, `hooks post-tool` appends one line per payload to `.bdk/.machine/logs/<session>.live.log`: the local time, the agent id and type (`main` without `agent_id`), the tool name, the tool input on one line cut to 200 characters, `ok` or the error or exit code, and the first 3 lines of the result. A `PostToolUseFailure` payload is marked `failed`. The line holds no thinking and no model text; those come from the render.

**Session-end render.** When the marker exists, `hooks session-end` runs the render of `kernel-cli/diagnostics`, bdk diagnostics log, for its session, and its context names the written path. A render failure is reported in the context and never blocks the session end.

#### Scenario: session line

- **WHEN** `hooks session-start` receives a payload with `session_id` and `transcript_path` in a BDK project
- **THEN** the journal's last line has `kind: session`, the id and the transcript path

#### Scenario: agent stop with transcript path

- **WHEN** `hooks subagent-stop` receives the recorded `lifecycle.json` stop payload
- **THEN** the journal holds an `agent-stop` line with the agent id and its `agent_transcript_path`

#### Scenario: question counted

- **WHEN** `hooks post-tool` receives an `AskUserQuestion` payload with two questions from the main thread
- **THEN** the journal holds a `question` line with `agent: main` and `count: 2`

#### Scenario: guard block journaled with the agent

- **WHEN** `hooks pre-tool` denies a subagent's `bdk.mjs commit` with `guard/subagent-kernel-command`
- **THEN** the journal holds a line with `kind: guard`, `rule: guard/subagent-kernel-command` and the payload's `agent_id`

#### Scenario: verbose marker follows the setting

- **WHEN** `diagnostics.verbose` is true at `hooks session-start`, and false at the next one
- **THEN** `.bdk/.machine/verbose` exists after the first and is gone after the second

#### Scenario: live line written only with the marker

- **WHEN** `hooks post-tool` receives a `Bash` payload with the marker present, and the same payload without it
- **THEN** the first appends one line naming `Bash` to the session's live log, and the second appends nothing to it

#### Scenario: render at session end

- **WHEN** the marker exists and `hooks session-end` runs
- **THEN** `.bdk/.machine/logs/` holds the session's render and the hook's context names its path
