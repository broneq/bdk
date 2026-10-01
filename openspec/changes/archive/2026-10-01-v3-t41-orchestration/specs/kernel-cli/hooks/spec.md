## MODIFIED Requirements

### Requirement: bdk hooks session-start

SessionStart content hook: STARTUP text, configuration check, v2 layout detection, schema refresh. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-start`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionStart payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** One process instead of the three v2 SessionStart commands (a static `cat` of STARTUP, the rule-drift snapshot, `config check`). It prints the output of `ctx startup` first. In a BDK project it ends, as `stale`, the registry rows of other sessions whose agents have been silent for longer than `agents.ttl` (`kernel-state`, Agent registry), so a crashed session leaves no agent `running`. In a BDK project (a `.bdk/` directory at the project root) it then runs the validation of `config check`, which also refreshes the resolved snapshot and the offline schema copy under `.bdk/.machine/`, and the v2 layout detection of `doctor`. Every problem becomes a line after the STARTUP text: an error of the configuration (an unknown key, a removed v2 key with its replacement or reason, an invalid value, an unreadable file) is one line `[BDK] config: <why> Instead: <instead joined by "; ">`, a warning of `config check` is one line `[BDK] config warning: <path>: <message>` (except `legacy-settings`, which the layout line already names), and a v2 layout is one line `[BDK] v2 layout detected (<paths>): run bdk import.` A role that would read more rules than `rules.warn-above` (`kernel-settings`, Keys of rules and specs) is one line `[BDK] rules warning: <role> reads <n> rules (rules.warn-above: <limit>); switch rules off with rules.disabled or narrow them with applies.`, counted as `rules explain` selects them for the project's `languages` with no file set, so every scoped rule counts; one line names the role with the most rules. There is no cap on the rules a package carries, so this line is how a user learns the prompts grew; rule files that fail `rules check` are left to `doctor` and add no line here. A configuration problem is content, never a STOP block, because it must not make the model stop at session start. Outside a BDK project, and outside a git work tree (a standalone command, `kernel-cli`, Invocation), it prints the STARTUP text alone. The hook starts no MCP server and registers no code graph (ADR-0001). The payload is read and ignored in T13; `source` becomes relevant with T24. Inject mode: exits 0 always, and only an internal failure is a STOP block.
- **Writes:** `.bdk/.machine/`
- **Output:** `schema/cli/output/hooks-session-start.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; configuration problems are content lines, not rules; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks session-start --json
  ```

  ```json
  {
    "content": "# BDK Shared Foundation\n...\n\n[BDK] v2 layout detected (.bdk/settings.json): run bdk import.",
    "layout": "v2",
    "configProblems": 0
  }
  ```

- **Owner:** T13
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks session-start` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/hooks-session-start.json`

#### Scenario: STARTUP comes first

- **WHEN** `bdk hooks session-start` runs in any directory
- **THEN** its stdout starts with the exact output of `bdk ctx startup`

#### Scenario: project still sets a removed key

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true` and the hook runs
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, and after the STARTUP text one `[BDK] config:` line names `features.serena` and its reason

#### Scenario: policy/unknown-config-key

- **WHEN** `.bdk/settings.yaml` sets a key no module schema declares and the hook runs
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, and after the STARTUP text one `[BDK] config:` line carries the `why` and `instead` of `policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema and the hook runs
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, and after the STARTUP text one `[BDK] config:` line carries the `why` and `instead` of `policy/config-invalid`

#### Scenario: known keys stay silent

- **WHEN** `.bdk/settings.yaml` sets only registered keys, carries the current modeline and no v2 marker exists
- **THEN** stdout equals the output of `bdk ctx startup`

#### Scenario: not a BDK project

- **WHEN** the hook runs in a git work tree without `.bdk/`, or in a directory outside any git work tree
- **THEN** the exit code is 0, stdout equals the output of `bdk ctx startup` and nothing is written

#### Scenario: no MCP work at session start

- **WHEN** `bdk hooks session-start` runs in any project
- **THEN** it starts no `uvx` process, registers no code graph, and its output contains no line about `uvx` or an MCP server

#### Scenario: many rules warned

- **WHEN** `.bdk/settings.yaml` sets `rules.warn-above: 10` in a project with `languages: [typescript]`, and `bdk hooks session-start` runs
- **THEN** the exit code is 0 and the content ends with a line starting `[BDK] rules warning: implementer reads`, naming `rules.warn-above: 10`

#### Scenario: stale rows of a crashed session

- **WHEN** the registry holds a `running` row of another session whose heartbeat is an hour old and the hook runs
- **THEN** the row is `ended` with `ended-by: stale`, and the output is unchanged

### Requirement: bdk hooks pre-tool

PreToolUse guard: spec directory, subagent git, subagent kernel commands, `bdk.mjs hooks` from Bash, agent spawns and agent messages. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks pre-tool`
- **Availability:** `hook`
- **Mode:** `guard`; standalone (`kernel-cli`, Invocation): the guards read only the payload, so a tool call outside a git work tree is decided, not blocked with `runtime/not-a-repo`
- **Arguments:**
  - stdin: PreToolUse payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Reached only after the shell prefilter (Guard hooks file and prefilter). Reads a Bash command through the command reader (Pre-tool command reading) and applies the guards of Pre-tool guards in this order: `guard/spec-dir-write`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/lead-scope`, `guard/reader-write`, `guard/dispatch-prompt`, `guard/agent-spawn`, `guard/escalation-model`, `guard/agent-message`; the first match denies. A `SendMessage` that passes and names an agent the registry holds is recorded as a message for that agent (`kernel-state`, Agent registry), which `agents wait` returns. Denied kernel commands: every `orchestrator` and `hook` verb of `kernel-cli`, Availability classes, matched by exact verb. On deny the kernel prints the host's `permissionDecision: deny` JSON with the reason and exits 2 (stderr carries `<rule>: <reason>`). Main-thread git is never touched. The user's own `!` bash-mode commands do not pass through this hook (HOST-FACTS `bang-pretool`), a known gap. A payload that is not JSON, or lacks `tool_name` or `tool_input`, is blocked with `input/invalid-argument`.
- **Writes:** `.bdk/.machine/agents.sqlite`
- **Output:** `schema/cli/output/hooks-pre-tool.json` for `--json` on pass (the kernel's own decision record, used by tests); the error object on a block under `--json`; the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `guard/spec-dir-write`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/lead-scope`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/dispatch-prompt`, `guard/reader-write`, `guard/agent-spawn`, `guard/escalation-model`, `guard/agent-message`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks pre-tool --json
  ```

  ```json
  {
    "decision": "pass",
    "tool": "Bash",
    "subagent": false
  }
  ```

- **Owner:** T24
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks pre-tool --json` runs as in the example
- **THEN** the exit code is 0 (pass) and under `--json` stdout validates against `schema/cli/output/hooks-pre-tool.json`

#### Scenario: guard/spec-dir-write

- **WHEN** a tool call writes under `.bdk/specs/` (V1-7)
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/spec-dir-write`

#### Scenario: guard/subagent-git

- **WHEN** a subagent ran a destructive or history-writing git command (T3)
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/subagent-git`

#### Scenario: guard/subagent-kernel-command

- **WHEN** a subagent invoked an `orchestrator` or `hook` class command (`kernel-cli`, Availability classes)
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/subagent-kernel-command`

#### Scenario: guard/hooks-from-bash

- **WHEN** any thread invoked `bdk.mjs hooks` through Bash (T1 defence in depth)
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/hooks-from-bash`

#### Scenario: guard/nested-stage-command

- **WHEN** any thread runs `claude -p "/bdk:plan"` through Bash
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/nested-stage-command`

#### Scenario: guard/dispatch-prompt

- **WHEN** the main thread calls `Agent` with `subagent_type: bdk:worker` and a prompt that holds the package path and three sentences of task text
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/dispatch-prompt`

#### Scenario: guard/reader-write

- **WHEN** a payload with `agent_type: bdk:reader` carries the Bash command `echo x > notes.md`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/reader-write`

#### Scenario: guard/lead-scope

- **WHEN** a `bdk:lead` payload whose package targets part `02` runs `bdk.mjs attempt open task-redispatch 03-1`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/lead-scope`

#### Scenario: guard/agent-spawn

- **WHEN** a `bdk:worker` payload calls `Agent` with `subagent_type: bdk:worker`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/agent-spawn`

#### Scenario: guard/escalation-model

- **WHEN** an `Agent` call names a dispatch package whose frontmatter holds `model: opus` and the call sets no `model`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/escalation-model`

#### Scenario: guard/agent-message

- **WHEN** a subagent's `SendMessage` names no ledger id
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/agent-message`

### Requirement: Hook payloads

The `hooks` group SHALL read the host's JSON payload from stdin and answer in the shape the host expects for that event.

The `hooks` group reads the host's JSON payload from stdin and answers in the shape the host expects for that event (Claude Code hooks reference, "Hook input" and "Hook output"). Field names below are the recorded ones: every payload cited here is in `tests/fixtures/host-payloads/2.1.281/` (T01) or, for the agent events, `tests/fixtures/host-payloads/2.1.284/` (T41), with machine-specific values replaced by placeholders. Where no recording exists the row says so. Common input fields on every event: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and `permission_mode` on every event except `SessionEnd` (HOST-FACTS `end-payload`). The kernel ignores fields it does not list.

| Command                     | Event                                                           | Fixture                                                                                                                                                                                                                                                       | Input fields the kernel reads                                                                                                                                                                                                                                                                                                                                                                          | stdout on pass (exit 0)                                                                                                                                                    | Block                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks session-start`       | `SessionStart`                                                  | none in 2.1.281 (the field list is from the hooks reference)                                                                                                                                                                                                  | `source` (`startup`, `resume`, `clear`, `compact`), `cwd`; read by no behaviour yet                                                                                                                                                                                                                                                                                                                    | The STARTUP Markdown, prepended to the session context by the host. A configuration problem or a v2 layout is a line inside that Markdown.                                 | Never. Inject mode: exit 0 always.                                                                                                                                                |
| `hooks session-end`         | `SessionEnd`                                                    | `session-end-clear.json` (`reason: "clear"`), `session-end-term.json` (`reason: "other"`), `upe-typed.json` (`reason: "prompt_input_exit"`)                                                                                                                   | `reason`                                                                                                                                                                                                                                                                                                                                                                                               | Empty, or one line naming the checkpoint commit. The host shows nothing from this event.                                                                                   | Never; the event cannot block. Fires on `/clear`, `/exit`, headless end and SIGTERM, not on SIGKILL (HOST-FACTS `end-clear`, `end-exit`, `end-headless`, `end-term`, `end-kill`). |
| `hooks prompt-expansion`    | `UserPromptExpansion`                                           | `upe-typed.json` (interactive), `allowed.json` (headless `claude -p`)                                                                                                                                                                                         | `hook_event_name`, `session_id`, `command_name` (namespaced, `bdk:plan`; HOST-FACTS `upe-name`), `command_args` (raw string, `""` when empty; `--skip-verify` is an exact token of it, P2; `command_input`, the hooks reference's name, when `command_args` is absent), `expansion_type` (`slash_command`), `prompt`                                                                                   | Plain text: the gate status (the gate, what passed it, the pending `review: true` entries). The host adds it to the expanded skill's context.                              | Exit 2 with `<rule>: <why>` on stderr; the host shows it and does not run the skill.                                                                                              |
| `hooks pre-tool`            | `PreToolUse`                                                    | `pre-bash.json` (main thread, no `agent_id`), `agent-fg.json` and `agent-bg.json` (subagent, `agent_id` and `agent_type` present), `pre-write.json`, `pre-edit.json`, `pre-notebookedit.json`, `agent-fg.json` (`Agent`), `send-live-id.json` (`SendMessage`) | `tool_name`, `tool_input.command` (Bash), `tool_input.file_path` (Write, Edit), `tool_input.notebook_path` (NotebookEdit; HOST-FACTS `input-notebookedit`), `tool_input.subagent_type` and `tool_input.prompt` (Agent; HOST-FACTS `agent-tool-name`), `tool_input.to` and `tool_input.message` (SendMessage), `agent_id` (presence means subagent; HOST-FACTS `main-no-agent-id`), `agent_type`, `cwd` | Nothing: an empty stdout with exit 0 lets the host apply its normal permission flow.                                                                                       | Exit 2, `<rule>: <reason>` on stderr, and on stdout the host's decision object (below).                                                                                           |
| `hooks post-tool`           | `PostToolUse`                                                   | `lifecycle-bg.json` (`Agent`, `status: async_launched`), `lifecycle.json` (`Agent`, `status: completed`), `stop-kill.json` (`TaskStop`)                                                                                                                       | `tool_name`, `agent_id` (absent for the main thread), `tool_input.prompt` (Agent), `tool_response.agentId` and `tool_response.status` (Agent), `tool_input.task_id` and `tool_response.task_type` (TaskStop)                                                                                                                                                                                           | Nothing.                                                                                                                                                                   | Never; the tool has already run.                                                                                                                                                  |
| `hooks subagent-start`      | `SubagentStart`                                                 | `lifecycle-bg.json`, `inject-id.json`                                                                                                                                                                                                                         | `agent_id`, `agent_type`, `session_id`                                                                                                                                                                                                                                                                                                                                                                 | The host's `hookSpecificOutput` with `hookEventName: SubagentStart` and `additionalContext` (HOST-FACTS `start-context`), for a `bdk:` agent type only; nothing otherwise. | Never; the event cannot block.                                                                                                                                                    |
| `hooks subagent-stop`       | `SubagentStop`                                                  | `lifecycle.json`, `subagent-stop-block.json`                                                                                                                                                                                                                  | `agent_id`, `agent_type`, `stop_hook_active`, `background_tasks`                                                                                                                                                                                                                                                                                                                                       | Nothing: the agent ends.                                                                                                                                                   | `{"decision": "block", "reason": ...}` on stdout with exit 0: the agent continues with `reason` (HOST-FACTS `stop-block`).                                                        |
| `hooks stop`                | `Stop`                                                          | `stop-block.json`                                                                                                                                                                                                                                             | `session_id`, `stop_hook_active`, `background_tasks`                                                                                                                                                                                                                                                                                                                                                   | Nothing: the turn ends.                                                                                                                                                    | `{"decision": "block", "reason": ...}` on stdout with exit 0: the main thread continues with `reason` (HOST-FACTS `stop-block`).                                                  |
| `hooks skill-exists <name>` | `UserPromptSubmit` (declared in a skill's frontmatter `hooks:`) | none in 2.1.281                                                                                                                                                                                                                                               | none; the name comes from the command line, the payload only proves the event                                                                                                                                                                                                                                                                                                                          | One line of context when the skill is missing, empty when installed.                                                                                                       | Never. Inject mode.                                                                                                                                                               |

`hooks pre-tool` block, printed on stdout exactly as the host expects it (hooks reference, `PreToolUse` decision control), with the same text on stderr:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "guard/subagent-git: subagents may not run git stash; return blocked with the cause instead of changing the shared working tree or history (BDK T3)"
  }
}
```

The reason always starts with the rule id, then names the verb or path, then the instruction. The kernel never answers `allow` or `ask`: a pass is silence, so that the host's own permission rules stay in force; `ask` in the main thread stays an unused extension.

| Rule                            | Reason after the rule id                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `guard/subagent-git`            | `subagents may not run <verb>; return blocked with the cause instead of changing the shared working tree or history (BDK T3)`     |
| `guard/subagent-kernel-command` | `subagents may not run bdk <verb>, an <class> command; return blocked with the cause, the orchestrator runs it (BDK T3)`          |
| `guard/hooks-from-bash`         | `bdk hooks <verb> runs only from the host's hooks; stop and let the user type the stage command (BDK T1)`                         |
| `guard/nested-stage-command`    | `a nested claude session would type <command> as the user; stop and ask the user to type it (BDK T1)`                             |
| `guard/spec-dir-write`          | `<path> is under .bdk/specs/, which only bdk spec merge writes at close; put the change into the Change's spec-delta/ (BDK V1-7)` |
| `guard/reader-write`            | `the <adapter> adapter may not write files (<command>); report through bdk log add or bdk log ingest instead (BDK T23-D20)`       |
| `guard/dispatch-prompt`         | `a BDK dispatch prompt is the package path plus at most one sentence; put the context into the package (BDK T23-D0)`              |

#### Scenario: pre-tool deny shape

- **WHEN** `hooks pre-tool` blocks a tool call
- **THEN** stdout is the host's `hookSpecificOutput` object with `permissionDecision: deny` and a `permissionDecisionReason` that starts with the rule id, the same text is on stderr, and the exit code is 2

#### Scenario: pre-tool pass is silence

- **WHEN** `hooks pre-tool` finds nothing to deny
- **THEN** stdout is empty and the exit code is 0, so the host's own permission rules stay in force

#### Scenario: unknown field

- **WHEN** a payload carries fields the table does not list
- **THEN** the kernel ignores them

#### Scenario: start context names the agent

- **WHEN** the recorded `SubagentStart` payload of `inject-id.json` arrives for a `bdk:worker` whose parent's `Agent` call was linked before
- **THEN** stdout is one `hookSpecificOutput` object whose `additionalContext` holds `BDK-AGENT-ID: <agent_id>`, `BDK-PARENT: <parent id>` and `BDK-PACKAGE: <package path>`

#### Scenario: non-BDK agent gets no context

- **WHEN** a `SubagentStart` payload arrives with `agent_type: Explore`
- **THEN** the row is recorded and stdout is empty

### Requirement: Guard hooks file and prefilter

`hooks/hooks.json` SHALL register the guards, the agent hooks and the session-end hook as below, the `PreToolUse` and `PostToolUse` scripts SHALL write the heartbeat in the shell, and each SHALL start Node only when its shell prefilter finds the payload can be affected.

| Event                 | Matcher                             | Command                                                                                                                                                          |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse`          | none (every tool)                   | the guard form below with `pre-tool.sh`                                                                                                                          |
| `PostToolUse`         | none (every tool)                   | the guard form below with `post-tool.sh`                                                                                                                         |
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

`pre-tool.sh` calls the kernel only when the raw payload contains one of: `.bdk/specs`; `bdk.mjs` and `hooks`; `/bdk:`; `"agent_id"` and either `git` or `bdk.mjs`; `bdk:reader`, `bdk:reviewer`, `bdk:scout` or `bdk:lead`; `"subagent_type"` and either `bdk:worker`, `bdk:runner` or `bdk:lead`; `SendMessage` as `tool_name`. Otherwise it exits 0 without starting Node. `post-tool.sh` calls the kernel only when `.bdk/` exists and `tool_name` is `Agent` or `TaskStop`. The prefilter only over-approximates: whatever it lets through, the kernel decides from the parsed payload.

#### Scenario: hooks file entries

- **WHEN** `hooks/hooks.json` is inspected
- **THEN** it holds exactly the `SessionStart` entry of `plugin-tooling` and the seven entries above, and each guard script's kernel line matches `guard-wrapper`

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

### Requirement: Pre-tool guards

`hooks pre-tool` SHALL decide each tool call with the guards below; a subagent is a payload with `agent_id` (HOST-FACTS `agent-fg`, `agent-bg`, `main-no-agent-id`).

- **Spec directory** (V1-7, every thread): an `Edit`, `Write` or `NotebookEdit` whose `file_path` or `notebook_path`, relative to the project root, lies under `.bdk/specs/`, or a Bash write whose target lies under `.bdk/specs/`, is denied with `guard/spec-dir-write`. Reading a spec passes.
- **Hooks from Bash** (T1, every thread): a kernel command whose verb is a `hook` class command is denied with `guard/hooks-from-bash`.
- **Nested stage command** (T1, every thread): a simple command with the command word `claude` and a word starting with `/bdk:plan`, `/bdk:execute`, `/bdk:close` or `/bdk:run` is denied with `guard/nested-stage-command`.
- **Subagent git** (T3): a git command whose verb is `stash`, `reset`, `clean`, `restore`, `commit`, `add`, `merge`, `rebase`, `cherry-pick` or `push`; `checkout` with `--`, a `.` argument, `-f` or `--force`; `switch` with `--discard-changes`, `-f` or `--force`. Denied with `guard/subagent-git`. `git checkout <branch>`, `git status`, `git diff` and `git log` pass.
- **Subagent kernel command** (T3): a kernel command whose verb is an `orchestrator` class command is denied with `guard/subagent-kernel-command`; `agent` and `read` verbs, `--help` and unknown verbs pass. A `bdk:lead` payload may run `attempt open`, `attempt close`, `dispatch build` and `commit` on a target inside the part of its own package, and is denied with `guard/lead-scope` on any other target (`kernel-cli`, Availability classes, Lead exception); a lead with no package in the registry is denied all four with `guard/lead-scope`.
- **Read-only adapters** (T23-D14, D20, T41-D11): a Bash write from a payload whose `agent_type` is `bdk:reader`, `bdk:reviewer`, `bdk:scout` or `bdk:lead` is denied with `guard/reader-write`.
- **Dispatch prompt** (T23-D0): an `Agent` call whose `subagent_type` is `bdk:worker`, `bdk:reader`, `bdk:reviewer`, `bdk:runner`, `bdk:scout` or `bdk:lead` is denied with `guard/dispatch-prompt` unless its prompt holds exactly one path matching `(^|/)\.bdk/changes/[^/\s]+/dispatch/[^/\s]+\.md` and, without that path, at most one sentence: no blank line, at most one sentence end, at most 200 characters. Other `subagent_type` values pass. A `bdk:scout` started by a `bdk:worker` is exempt: it has no package and its prompt is the worker's question (`role-contracts`, Role contract content).
- **Agent spawn** (T41-D4): an `Agent` call from a subagent is denied with `guard/agent-spawn` unless the caller is `bdk:lead` and `subagent_type` is `bdk:worker`, `bdk:runner`, `bdk:reviewer` or `bdk:scout`, or the caller is `bdk:worker`, `subagent_type` is `bdk:scout` and the scouts started by agents holding the caller's ticket number fewer than `agents.scout.max-per-ticket`. Calls from the main thread and from non-BDK agents are not checked by this guard.
- **Escalation model** (T41-D14, every thread): an `Agent` call whose prompt names one dispatch package with a `model` in its frontmatter is denied with `guard/escalation-model` unless `tool_input.model` equals it; the host starts the agent on that model instead of its adapter's (HOST-FACTS `model-override`). A package that is missing or does not parse has no model for this guard.
- **Agent message** (T41-D5): a `SendMessage` from a subagent is denied with `guard/agent-message` when `tool_input.message` holds no ledger id (`L-` and eight characters of `[0-9a-z]`) of the active Change, when it is longer than `agents.message.max-chars`, or when `tool_input.to` is not `main` and names an agent that is not `running` or `starting` in the registry. A message from the main thread passes unchecked. The reason names the check that failed and, for a recipient that is not running, `bdk agents list --affected-by <entry>`.

Main-thread git and main-thread orchestrator commands are never denied.

#### Scenario: subagent git stash denied, main thread passes

- **WHEN** the recorded `agent-fg.json` payload carries the Bash command `git stash`, and the recorded `pre-bash.json` payload carries the same command
- **THEN** the first exits 2 with `guard/subagent-git` naming `git stash` and the second exits 0 with empty stdout

#### Scenario: subagent bdk commit denied

- **WHEN** a subagent payload carries `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" commit 02-3`
- **THEN** it exits 2 with `guard/subagent-kernel-command` naming `bdk commit`

#### Scenario: subagent read verb passes

- **WHEN** a subagent payload carries `node "$P/dist/bdk.mjs" attempt list --json` or `node "$P/dist/bdk.mjs" log add finding "x" --ref a.ts`
- **THEN** it exits 0

#### Scenario: edit under the spec directory denied

- **WHEN** the recorded `pre-edit.json` payload's `file_path` is `<PROJECT>/.bdk/specs/auth/spec.md`, or `pre-notebookedit.json`'s `notebook_path` is under `.bdk/specs/`
- **THEN** it exits 2 with `guard/spec-dir-write` naming the path

#### Scenario: reading a spec passes

- **WHEN** the main thread runs `cat .bdk/specs/auth/spec.md | grep Scenario`
- **THEN** it exits 0

#### Scenario: dispatch with the package path passes

- **WHEN** the main thread calls `Agent` with `subagent_type: bdk:worker` and the prompt `.bdk/changes/2026-09-25-login/dispatch/02-3-implementer-A-7f3k9m2q.md Start with the failing test.`
- **THEN** it exits 0

#### Scenario: v2 agent untouched

- **WHEN** the main thread calls `Agent` with `subagent_type: bdk:explorer` and a long prompt
- **THEN** it exits 0

#### Scenario: reader runs tests and kernel commands

- **WHEN** a `bdk:reviewer` payload runs `pnpm test 2>&1 | tail -5` or `node "$P/dist/bdk.mjs" log add finding "x" --ref a.ts --ticket A-7f3k9m2q`
- **THEN** it exits 0

#### Scenario: lead dispatches a worker

- **WHEN** a `bdk:lead` payload calls `Agent` with `subagent_type: bdk:worker`, `run_in_background: true` and the package path of task `02-3`
- **THEN** it exits 0

#### Scenario: worker starts a scout within the limit

- **WHEN** a `bdk:worker` payload calls `Agent` with `subagent_type: bdk:scout` and a question as the prompt, and no scout ran under its ticket
- **THEN** it exits 0

#### Scenario: third scout under one ticket

- **WHEN** `agents.scout.max-per-ticket` is 2, two scouts ran under the worker's ticket and the worker starts a third
- **THEN** it exits 2 with `guard/agent-spawn` naming the limit

#### Scenario: message to a finished sibling

- **WHEN** a worker sends `L-q7w2e9r4 changes the token format` to an agent that is `ended`
- **THEN** it exits 2 with `guard/agent-message`, and the reason names `bdk agents list --affected-by L-q7w2e9r4`

#### Scenario: long message

- **WHEN** a worker sends a 900-character message naming `L-q7w2e9r4` to its running lead
- **THEN** it exits 2 with `guard/agent-message` naming `agents.message.max-chars`

#### Scenario: admitted message is recorded

- **WHEN** a worker sends `L-q7w2e9r4 changes the token format` to its running lead
- **THEN** it exits 0 and the lead's next `bdk agents wait` returns a `message` event with the worker's id and `L-q7w2e9r4`

### Requirement: Guard latency

The guards SHALL stay within the NFR "Latency" budgets, measured locally through the bundle in the `perf` test project (`pnpm test:perf`), which CI does not run.

On a fixture of 750 recorded-shape `PreToolUse` payloads (main-thread and subagent Bash, edit tools, `Agent` calls, a project path containing `git`): on a payload the prefilter drops, the p95 of the time the guard adds over a bare `sh -c` reading the same payload is under 5 ms; the p95 of a `pre-tool` call that reaches the kernel is under 150 ms; the p95 of `prompt-expansion` on a typed stage command that writes its transition is under 150 ms. With the heartbeat (T41-D6): on a subagent payload the prefilter drops, `pre-tool.sh` and `post-tool.sh` each add a p95 under 5 ms over a bare `sh -c`; the p95 of `hooks subagent-start`, `hooks subagent-stop`, `hooks stop` and `hooks post-tool` is under 150 ms each; `agents wait` returns within 1.5 s of the event that ends it.

#### Scenario: latency budgets

- **WHEN** `pnpm test:perf` runs the guard benchmarks
- **THEN** each p95 is under its budget, and the report names every measured value

### Requirement: Pre-tool command reading

`hooks pre-tool` SHALL read a Bash command as a list of simple commands, each with its words and output redirections, and apply the Bash guards to command words, never to the raw text.

The reader handles single and double quotes, backslash escapes, `#` comments at a word start, heredocs (`<<EOF`, `<<-EOF`, `<<'EOF'`; the body up to the delimiter line is skipped), the separators `;`, `&&`, `||`, `|`, `&` and newlines, and `(`, `)`, `{`, `}` as grouping; `$(...)` and backticks stay inside their word. A simple command whose command word is `sh`, `bash`, `zsh` or `dash` with `-c <string>`, or `eval`, is read again from its string, three levels deep. The command word is the first word after variable assignments and the wrappers `env` (with its options and assignments), `command`, `exec`, `time`, `nice`, `nohup` and `sudo`, compared by basename.

- A **git command** has the command word `git`; its verb is the first word after git's global options (`-C <path>`, `-c <k=v>`, `--git-dir[=]<d>`, `--work-tree[=]<d>`, `--no-pager`, `-P`, `--no-optional-locks`, `--literal-pathspecs`).
- A **kernel command** has a word whose basename is `bdk.mjs` as its command word or after `node` and node's options, or the command word `bdk` (the role contracts write kernel commands as `bdk <command>`, and a model defines a `bdk` shell function in the same Bash command to run them); its verb is resolved from the following words against the bundled command index, exactly as the kernel dispatches.
- A **write** is an output redirection (`>`, `>>`, `>|`, `&>`, `&>>`, `<n>>`) to anything but `/dev/null`, `/dev/stdout`, `/dev/stderr` or a file descriptor, or the target of a writing command: `tee` (its file arguments), `sed` and `perl` with `-i` or `--in-place` (their file arguments), `cp` and `install` (the last argument), `mv`, `rm`, `rmdir`, `touch`, `mkdir`, `ln`, `truncate`, `chmod`, `chown` (every argument that is not an option), `dd` (`of=`), `git apply`.

The reader is best effort for a careless model (design NFR "Security"): an interpreter (`python -c`, `node -e`), a script file, a variable, or an alias or a function under another name than `bdk` can still hide a verb or a write.

#### Scenario: quoted git verb is not a command

- **WHEN** a subagent runs `git commit -m "revert with git reset"` or `echo "git stash"`
- **THEN** the first is denied as `git commit` and the second passes, and no reason names `git reset` or `git stash`

#### Scenario: heredoc body is not read

- **WHEN** a `bdk:reader` payload runs `node "$P/dist/bdk.mjs" log ingest --ticket A-7f3k9m2q <<'EOF'` with a body line `a > b` and `git stash`
- **THEN** it passes

#### Scenario: nested shell is read

- **WHEN** a subagent runs `bash -c 'cd x && git stash'`
- **THEN** it is denied with `guard/subagent-git` naming `git stash`

#### Scenario: git global options

- **WHEN** a subagent runs `git -C ../repo -c core.pager=cat reset --hard`
- **THEN** it is denied with `guard/subagent-git` naming `git reset`

#### Scenario: a bdk shell function is the kernel

- **WHEN** a `bdk:worker` payload runs `bdk() { node "$P/dist/bdk.mjs" "$@"; }; bdk commit 01-1`
- **THEN** it is denied with `guard/subagent-kernel-command` naming `bdk commit`

## ADDED Requirements

### Requirement: bdk hooks subagent-start

SubagentStart hook: record the agent and hand it its identity. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks subagent-start`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SubagentStart payload (Hook payloads).
- **Behaviour:** Records `agent_id`, `agent_type`, `session_id` and `started-at` in the registry, completing the row that the parent's `PostToolUse` on `Agent` created for a background spawn (HOST-FACTS `agent-link`), or creating it. For an `agent_type` in the `bdk:` namespace it answers with `additionalContext` of these lines, the absent ones left out: `BDK-AGENT-ID: <agent_id>`, `BDK-PARENT: <parent id or main>`, `BDK-PACKAGE: <package path>`, `BDK-TICKET: <ticket>`. The host gives an agent no other way to learn its id (HOST-FACTS `start-context`, `agent-params`). A foreground spawn is linked only when it ends, so such an agent gets its own id alone. Outside a BDK project, or with an unreadable payload, stdout is empty. Inject mode: exits 0 always.
- **Writes:** `.bdk/.machine/agents.sqlite`
- **Output:** `schema/cli/output/hooks-subagent-start.json` for `--json`; the host's stdout shape otherwise (Hook payloads).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks subagent-start --json
  ```

  ```json
  {
    "agent": "a1b2c3d4e5f6a7b8c",
    "parent": "a9f8e7d6c5b4a3f2e",
    "package": ".bdk/changes/2026-09-25-login/dispatch/02-4-implementer-A-9k2m4n6p.md",
    "context": "BDK-AGENT-ID: a1b2c3d4e5f6a7b8c\nBDK-PARENT: a9f8e7d6c5b4a3f2e\nBDK-PACKAGE: .bdk/changes/2026-09-25-login/dispatch/02-4-implementer-A-9k2m4n6p.md\nBDK-TICKET: A-9k2m4n6p"
  }
  ```

- **Owner:** T41
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks subagent-start --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/hooks-subagent-start.json`

#### Scenario: foreground spawn gets its id only

- **WHEN** a `bdk:runner` starts without a linked row, as with a foreground spawn
- **THEN** `additionalContext` holds `BDK-AGENT-ID` and no `BDK-PARENT`

### Requirement: bdk hooks post-tool

PostToolUse hook: link a spawned agent to its parent and record a killed agent. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks post-tool`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: PostToolUse payload (Hook payloads).
- **Behaviour:** Reached only for `Agent` and `TaskStop` (Guard hooks file and prefilter). For `Agent`: records `tool_response.agentId` with `parent` (the payload's `agent_id`, or `main` without one), `linked-at`, and the package, ticket and target named by the dispatch package path in `tool_input.prompt`; with `status: completed` (a foreground spawn) it also ends the child with `ended-by: agent-result`. For `TaskStop`: ends the agent named by `tool_input.task_id` with `ended-by: task-stop` when `tool_response.task_type` is `local_agent` (HOST-FACTS `stop-on-taskstop`). Any other payload is ignored. stdout is always empty; the heartbeat of the call is the shell's (Guard hooks file and prefilter). Inject mode: exits 0 always.
- **Writes:** `.bdk/.machine/agents.sqlite`
- **Output:** `schema/cli/output/hooks-post-tool.json` for `--json`; nothing otherwise.
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks post-tool --json
  ```

  ```json
  {
    "tool": "Agent",
    "linked": { "agent": "a1b2c3d4e5f6a7b8c", "parent": "a9f8e7d6c5b4a3f2e", "ticket": "A-9k2m4n6p" },
    "ended": null
  }
  ```

- **Owner:** T41
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks post-tool --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/hooks-post-tool.json`

#### Scenario: background spawn linked at launch

- **WHEN** the recorded `PostToolUse` on `Agent` of `lifecycle-bg.json` with `status: async_launched` arrives from a lead whose prompt names a dispatch package
- **THEN** the child's row exists with the lead as `parent`, the package's ticket, and state `starting`

#### Scenario: foreground result ends the child

- **WHEN** the recorded `PostToolUse` on `Agent` of `lifecycle.json` with `status: completed` arrives
- **THEN** the child is `ended` with `ended-by: agent-result`

### Requirement: Continuation check

`hooks stop` and `hooks subagent-stop` SHALL block the end of a turn exactly when the agent's own scope still holds work it can do now, and SHALL let it end otherwise (T41-D7, HOST-FACTS `stop-block`).

The check answers `block` only when the thread has open work:

| Thread                 | Open work                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| main thread            | The latest `transition` whose `session` is this `session_id` opened a stage, and `bdk next` returns a `ready` or `stale` artifact of that stage, not waiting on a gate or on the user (`kernel-cli/graph`, bdk next). |
| `bdk:lead`             | Its `part-lead` ticket is open, and a task ticket of its part is open, or a task of its part is not committed, or its own report is not stored.                                                                       |
| any other `bdk:` agent | It has an active package and the package's `report` path does not exist.                                                                                                                                              |

and, for every thread, all of these hold: no entry of `background_tasks` has `status: running` other than the agent itself (HOST-FACTS `subagent-stop`), since a finished background child wakes its parent; no `question` entry of the Change is open and the Change is not parked; and `continuations` is below `agents.continuation.max`. Non-BDK subagents and payloads outside a BDK project always pass.

A block answers `{"decision": "block", "reason": "<reason>"}` on stdout with exit 0 and increments `continuations`. The reason names the open work and the next command, for example `BDK: execute-part:02 is ready (bdk next). Continue it; end your turn only to ask the user a question or to report a blocker.` or `BDK: your report for A-9k2m4n6p is not stored. Pipe it to bdk log ingest --ticket A-9k2m4n6p, then return your envelope.`; for a lead it adds `elapsed <n>s` (T41-D8). Progress resets `continuations` to 0: a new ledger entry, a stored report or a closed ticket in the agent's scope since the previous block. When `continuations` reaches `agents.continuation.max`, the check passes and writes one `finding` with `source: kernel`, `review: true` and the refs of the open work, stating that the agent stopped with work open. A block never ends the agent; a pass of `hooks subagent-stop` ends it with `ended-by: subagent-stop`.

#### Scenario: T40 early stop is sent back

- **WHEN** during `/bdk:execute` the main thread ends its turn after part 01 with `execute-part:02` ready, no background task and no open question
- **THEN** `hooks stop` answers `block` with a reason naming `execute-part:02`, and `continuations` is 1

#### Scenario: question to the user ends the turn

- **WHEN** the same happens while a `question` entry is open
- **THEN** `hooks stop` passes

#### Scenario: background leads keep main waiting

- **WHEN** the main thread ends its turn while two leads run in the background
- **THEN** `hooks stop` passes, and the host's task notification wakes it later (HOST-FACTS `lead-detach`)

#### Scenario: worker without a report

- **WHEN** a `bdk:worker` ends its turn and its package's `report` path does not exist
- **THEN** `hooks subagent-stop` answers `block` naming `bdk log ingest --ticket <ticket>`

#### Scenario: lead with a task left

- **WHEN** a `bdk:lead` ends its turn while task `02-3` of its part is not committed and nothing runs in the background
- **THEN** `hooks subagent-stop` answers `block` naming `02-3` and `elapsed`

#### Scenario: limit without progress

- **WHEN** `agents.continuation.max` is 3 and a worker ends its turn a fourth time with no new entry, report or closed ticket since the first block
- **THEN** the hook passes, one `finding` with `review: true` names the worker's ticket, and the worker is `ended`

#### Scenario: ordinary conversation

- **WHEN** the main thread ends a turn in a session with no stage transition
- **THEN** `hooks stop` passes

### Requirement: bdk hooks subagent-stop

SubagentStop hook: the continuation check for a subagent, then its end in the registry. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks subagent-stop`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SubagentStop payload (Hook payloads).
- **Behaviour:** Runs the Continuation check for the agent of `agent_id`. On `block` it prints the host's block object and leaves the agent `running`; on `pass` it ends the agent with `ended-by: subagent-stop` and prints nothing. The event is missing when an agent is cut off by `maxTurns` or killed (HOST-FACTS `stop-on-maxturns`, `stop-on-taskstop`); the registry's lease covers those ends (`kernel-state`, Agent registry). An unreadable payload passes. Inject mode: exits 0 always.
- **Writes:** `.bdk/.machine/agents.sqlite`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/hooks-subagent-stop.json` for `--json`; the host's stdout shape otherwise (Hook payloads).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks subagent-stop --json
  ```

  ```json
  {
    "agent": "a1b2c3d4e5f6a7b8c",
    "decision": "block",
    "reason": "BDK: your report for A-9k2m4n6p is not stored. Pipe it to bdk log ingest --ticket A-9k2m4n6p, then return your envelope.",
    "continuations": 1
  }
  ```

- **Owner:** T41
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks subagent-stop --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/hooks-subagent-stop.json`

#### Scenario: done worker ends

- **WHEN** a `bdk:worker` whose report is stored ends its turn
- **THEN** stdout is empty and the agent is `ended` with `ended-by: subagent-stop`

### Requirement: bdk hooks stop

Stop hook: the continuation check for the main thread. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks stop`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: Stop payload (Hook payloads).
- **Behaviour:** Runs the Continuation check for the main thread of `session_id`, whose `continuations` the registry keeps for that session. On `block` it prints the host's block object; on `pass` it prints nothing. Without an active Change on the branch it passes. A refusal a Change-scoped command would emit also passes silently, because a broken Change must not trap the user in a turn; `bdk next` and `doctor` still report it. Inject mode: exits 0 always.
- **Writes:** `.bdk/.machine/agents.sqlite`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/hooks-stop.json` for `--json`; the host's stdout shape otherwise (Hook payloads).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks stop --json
  ```

  ```json
  {
    "decision": "block",
    "reason": "BDK: execute-part:02 is ready (bdk next). Continue it; end your turn only to ask the user a question or to report a blocker.",
    "continuations": 1
  }
  ```

- **Owner:** T41
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks stop --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/hooks-stop.json`

#### Scenario: broken Change never traps the user

- **WHEN** the Change's ledger holds an invalid entry and the main thread ends its turn
- **THEN** the hook passes with empty stdout
