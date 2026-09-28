## MODIFIED Requirements

### Requirement: bdk hooks session-end

SessionEnd content hook: Change checkpoint commit when enabled and safe. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-end`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionEnd payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Resolves the active Change of the branch and runs the `shared/store` checkpoint core that `change checkpoint` uses (`kernel-loops`, Checkpoint). Every outcome other than a commit is reported, never refused: `checkpoint.done` is false and `skipped` is `no active Change` or the reason the checkpoint core reports, as `change park` reports it (the disabled policy, nothing changed under the Change directory, the rebase, merge or cherry-pick in progress, the open tickets by id, the git hook's output), because the host ignores this event's output and exit code (hooks reference, `SessionEnd`) and implicit checkpoint callers report skips (T22). Content is empty, or one line `[BDK] checkpoint <sha7> of <change>` after a commit. Fires on `/clear`, `/exit`, SIGTERM and after every headless run (HOST-FACTS `end-clear`, `end-exit`, `end-term`, `end-headless`), never after SIGKILL (`end-kill`), so recovery never assumes it ran. The payload field is `reason` as recorded (HOST-FACTS `end-payload`), echoed in the output; an unreadable payload is ignored, since the checkpoint does not depend on it.
- **Writes:** `git:commit`
- **Output:** `schema/cli/output/hooks-session-end.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; a skipped checkpoint is data; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks session-end --json
  ```

  ```json
  {
    "content": "",
    "reason": "prompt_input_exit",
    "checkpoint": {
      "done": false,
      "skipped": "ticket A-7f3k9m2q is open; a subagent may still be writing"
    }
  }
  ```

- **Owner:** T24
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks session-end` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/hooks-session-end.json`

#### Scenario: checkpoint at session end

- **WHEN** the active Change has an uncommitted ledger entry, no ticket is open and the recorded `session-end-clear.json` payload arrives
- **THEN** the exit code is 0, a commit `chore(bdk): checkpoint <change>` holds only paths under `.bdk/changes/<id>/`, and stdout is the `[BDK] checkpoint` line

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 0, no commit is made, no `BDK STOP` line is printed and `checkpoint.skipped` names the open ticket

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress (V1-4)
- **THEN** the exit code is 0, no commit is made and `checkpoint.skipped` names the operation

#### Scenario: no active Change

- **WHEN** the branch has no active Change
- **THEN** the exit code is 0, stdout is empty and `checkpoint.skipped` is `no active Change`

### Requirement: bdk hooks prompt-expansion

UserPromptExpansion guard: the only writer of `source: user` stage transitions. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks prompt-expansion`
- **Availability:** `hook`
- **Mode:** `guard`; Change-scoped
- **Arguments:**
  - stdin: UserPromptExpansion payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Parses the payload first. A `command_name` outside the `bdk:` namespace, or a BDK skill that is neither a pipeline stage command nor `run`, passes with empty stdout and no Change lookup. For a stage command it checks the user-typed marker (Prompt-expansion outcomes), resolves the Change from the branch, reads the graph once and applies the outcomes of Prompt-expansion outcomes: gate ready -> pass and write `source: user`; gate not ready -> block naming what is missing; gate already done -> pass without writing (S5); no gate in the profile -> pass with a plain stage entry, carrying `skip-verify` for `/bdk:execute` when `command_args` holds the token `--skip-verify` (P2); `/bdk:run` -> `source: policy` entries for the ready `auto` gates (T02 decision R-9); no active Change -> block with the hint; kernel missing -> the guard script blocks with `guard/kernel-unavailable`. On pass, stdout is the gate status as plain text, which the host adds to the skill's context. `command_name` arrives namespaced (`bdk:plan`, HOST-FACTS `upe-name`) and a nested `claude -p "/bdk:plan"` counts as user-typed (`upe-headless`), which `hooks pre-tool` denies from tool calls (`guard/nested-stage-command`). The record is Change-scoped, but its registration asks the registry to leave the resolution to the handler, which resolves the Change only for a stage command, so a non-stage command passes without one.
- **Writes:** `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/hooks-prompt-expansion.json` for `--json` (the kernel's own decision record, used by tests); the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `policy/gate-not-ready`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks prompt-expansion --json
  ```

  ```json
  {
    "decision": "pass",
    "command": "plan",
    "stage": "plan",
    "gate": "gate:design",
    "entry": "L-g5h2j7qa",
    "wrote": "transition:user",
    "skipVerify": false
  }
  ```

- **Owner:** T24
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks prompt-expansion --json` runs as in the example
- **THEN** the exit code is 0 (pass) and under `--json` stdout validates against `schema/cli/output/hooks-prompt-expansion.json`

#### Scenario: policy/gate-not-ready

- **WHEN** the gate node is not ready
- **THEN** the exit code is 2 and the reason on stderr starts with `policy/gate-not-ready`

#### Scenario: policy/no-active-change

- **WHEN** the user types `/bdk:plan` on a branch without an active Change
- **THEN** the exit code is 2, nothing is written and the reason on stderr starts with `policy/no-active-change` and names `/bdk:change new`

#### Scenario: state/corrupted-index

- **WHEN** the Change's index cannot be opened for a stage command
- **THEN** the exit code is 2, not 4, and the reason on stderr starts with `state/corrupted-index`

#### Scenario: state/ledger-invalid

- **WHEN** a committed entry of the Change fails its schema and the user types a stage command
- **THEN** the exit code is 2 and the reason on stderr starts with `state/ledger-invalid`

#### Scenario: state/change-dir-missing

- **WHEN** the branch marker names a Change whose directory is gone and the user types a stage command
- **THEN** the exit code is 2 and the reason on stderr starts with `state/change-dir-missing`

#### Scenario: other command passes without a Change

- **WHEN** the recorded payload of `/bdk:mermaid-drawer` arrives on a branch without a Change
- **THEN** the exit code is 0, stdout is empty and nothing is written

### Requirement: bdk hooks pre-tool

PreToolUse guard: spec directory, subagent git, subagent kernel commands, `bdk.mjs hooks` from Bash. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks pre-tool`
- **Availability:** `hook`
- **Mode:** `guard`; standalone (`kernel-cli`, Invocation): the guards read only the payload, so a tool call outside a git work tree is decided, not blocked with `runtime/not-a-repo`
- **Arguments:**
  - stdin: PreToolUse payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Reached only after the shell prefilter (Guard hooks file and prefilter). Reads a Bash command through the command reader (Pre-tool command reading) and applies the guards of Pre-tool guards in this order: `guard/spec-dir-write`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/reader-write`, `guard/dispatch-prompt`; the first match denies. Denied kernel commands: every `orchestrator` and `hook` verb of `kernel-cli`, Availability classes, matched by exact verb. On deny the kernel prints the host's `permissionDecision: deny` JSON with the reason and exits 2 (stderr carries `<rule>: <reason>`). Main-thread git is never touched. The user's own `!` bash-mode commands do not pass through this hook (HOST-FACTS `bang-pretool`), a known gap. A payload that is not JSON, or lacks `tool_name` or `tool_input`, is blocked with `input/invalid-argument`.
- **Writes:** nothing
- **Output:** `schema/cli/output/hooks-pre-tool.json` for `--json` on pass (the kernel's own decision record, used by tests); the error object on a block under `--json`; the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `guard/spec-dir-write`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/dispatch-prompt`, `guard/reader-write`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
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

### Requirement: Hook payloads

The `hooks` group SHALL read the host's JSON payload from stdin and answer in the shape the host expects for that event.

The `hooks` group reads the host's JSON payload from stdin and answers in the shape the host expects for that event (Claude Code hooks reference, "Hook input" and "Hook output"). Field names below are the recorded ones: every payload cited here is in `tests/fixtures/host-payloads/2.1.281/` (T01), with machine-specific values replaced by placeholders. Where no recording exists the row says so. Common input fields on every event: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and `permission_mode` on every event except `SessionEnd` (HOST-FACTS `end-payload`). The kernel ignores fields it does not list.

| Command                     | Event                                                           | Fixture                                                                                                                                                                                                                  | Input fields the kernel reads                                                                                                                                                                                                                                                                                                                  | stdout on pass (exit 0)                                                                                                                       | Block                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks session-start`       | `SessionStart`                                                  | none in 2.1.281 (the field list is from the hooks reference)                                                                                                                                                             | `source` (`startup`, `resume`, `clear`, `compact`), `cwd`; read by no behaviour yet                                                                                                                                                                                                                                                            | The STARTUP Markdown, prepended to the session context by the host. A configuration problem or a v2 layout is a line inside that Markdown.    | Never. Inject mode: exit 0 always.                                                                                                                                                |
| `hooks session-end`         | `SessionEnd`                                                    | `session-end-clear.json` (`reason: "clear"`), `session-end-term.json` (`reason: "other"`), `upe-typed.json` (`reason: "prompt_input_exit"`)                                                                              | `reason`                                                                                                                                                                                                                                                                                                                                       | Empty, or one line naming the checkpoint commit. The host shows nothing from this event.                                                      | Never; the event cannot block. Fires on `/clear`, `/exit`, headless end and SIGTERM, not on SIGKILL (HOST-FACTS `end-clear`, `end-exit`, `end-headless`, `end-term`, `end-kill`). |
| `hooks prompt-expansion`    | `UserPromptExpansion`                                           | `upe-typed.json` (interactive), `allowed.json` (headless `claude -p`)                                                                                                                                                    | `hook_event_name`, `session_id`, `command_name` (namespaced, `bdk:plan`; HOST-FACTS `upe-name`), `command_args` (raw string, `""` when empty; `--skip-verify` is an exact token of it, P2; `command_input`, the hooks reference's name, when `command_args` is absent), `expansion_type` (`slash_command`), `prompt`                           | Plain text: the gate status (the gate, what passed it, the pending `review: true` entries). The host adds it to the expanded skill's context. | Exit 2 with `<rule>: <why>` on stderr; the host shows it and does not run the skill.                                                                                              |
| `hooks pre-tool`            | `PreToolUse`                                                    | `pre-bash.json` (main thread, no `agent_id`), `agent-fg.json` and `agent-bg.json` (subagent, `agent_id` and `agent_type` present), `pre-write.json`, `pre-edit.json`, `pre-notebookedit.json`, `agent-fg.json` (`Agent`) | `tool_name`, `tool_input.command` (Bash), `tool_input.file_path` (Write, Edit), `tool_input.notebook_path` (NotebookEdit; HOST-FACTS `input-notebookedit`), `tool_input.subagent_type` and `tool_input.prompt` (Agent; HOST-FACTS `agent-tool-name`), `agent_id` (presence means subagent; HOST-FACTS `main-no-agent-id`), `agent_type`, `cwd` | Nothing: an empty stdout with exit 0 lets the host apply its normal permission flow.                                                          | Exit 2, `<rule>: <reason>` on stderr, and on stdout the host's decision object (below).                                                                                           |
| `hooks skill-exists <name>` | `UserPromptSubmit` (declared in a skill's frontmatter `hooks:`) | none in 2.1.281                                                                                                                                                                                                          | none; the name comes from the command line, the payload only proves the event                                                                                                                                                                                                                                                                  | One line of context when the skill is missing, empty when installed.                                                                          | Never. Inject mode.                                                                                                                                                               |

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

### Requirement: Prompt-expansion outcomes

`hooks prompt-expansion` SHALL produce exactly the outcomes below.

The command's stage is the pipeline stage whose `command` is `/<command_name>` (`/bdk:plan` -> `plan`); its gate is the gate node whose `opens` names that stage. The **user-typed marker** is the recorded shape of HOST-FACTS `upe-fields`: `hook_event_name: UserPromptExpansion`, `expansion_type: slash_command`, a non-empty `session_id` and `command_name` in the `bdk:` namespace. A stage command whose payload lacks one of them is blocked with `input/invalid-argument` and writes nothing: an unknown payload shape is "no transition" (fail-closed).

| Situation                                                                                   | Exit | Writes                                                                                                                                                                                                                                                    | stdout / stderr                                                                                             |
| ------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Stage command whose gate is ready (`/bdk:plan` after `design`, `/bdk:close` after `review`) | 0    | `transition` with `source: user`, `gate`, `to` = the stage, the kernel clock, `session` = `session_id`, `command` = `prompt`, and `refs` = the gate node and its requirements that are not skipped                                                        | stdout: gate status as plain text                                                                           |
| Gate not ready                                                                              | 2    | nothing                                                                                                                                                                                                                                                   | stderr: `policy/gate-not-ready: <gate> is not ready for <command>: <requirement> is <state>, ...`           |
| Gate already done (the user retyped the command, or resumes on another machine, S5)         | 0    | nothing                                                                                                                                                                                                                                                   | stdout: gate status noting the earlier pass                                                                 |
| Stage command without a gate in this profile (`/bdk:execute`, or `tiny` skipping `design`)  | 0    | plain `transition` (`source: kernel`, `to` = the stage, `session`, `command`), with `skip-verify: true` for `/bdk:execute` when `command_args` holds `--skip-verify`; nothing when the latest transition to that stage already has the same `skip-verify` | stdout: the stage line                                                                                      |
| `/bdk:run`                                                                                  | 0    | one `transition` with `source: policy`, `gate` and `to` = the stage it opens, for each gate that is ready, not done and resolves to `policy.gates.<gate>: auto` (T02 decision R-9)                                                                        | stdout: the gates passed by policy and the manual gates the user still types, so the user sees them         |
| No active Change on the branch                                                              | 2    | nothing                                                                                                                                                                                                                                                   | stderr: `policy/no-active-change: ...; run /bdk:change new "<intent>" or bdk change resume <id>`            |
| Payload without the user-typed marker                                                       | 2    | nothing                                                                                                                                                                                                                                                   | stderr: `input/invalid-argument: the UserPromptExpansion payload has no <field>; no transition was written` |

No transition written here carries `input-hash`, so none changes a node's state (`kernel-pipeline`, Node states); only a gate reads them. A non-BDK command (`command_name` without the `bdk:` prefix) or a BDK skill that is neither a stage command nor `run` passes with empty stdout and no write. A nested `claude -p "/bdk:plan"` started from a tool call arrives as a user prompt (HOST-FACTS `upe-headless`); `hooks pre-tool` denies it (`guard/nested-stage-command`). The user's own `!` bash-mode commands do not pass through `PreToolUse` at all (HOST-FACTS `bang-pretool`), a known gap of the spec and command guards.

#### Scenario: gate ready

- **WHEN** the user types `/bdk:plan` and `gate:design` is ready
- **THEN** the kernel writes one `transition` entry with `source: user` and exits 0 with the gate status on stdout

#### Scenario: gate not ready

- **WHEN** the user types `/bdk:plan` and `gate:design` is not ready
- **THEN** the kernel writes nothing and exits 2 with `policy/gate-not-ready: <what is missing>` on stderr

#### Scenario: gate already done

- **WHEN** the user retypes a stage command whose gate is already done
- **THEN** the kernel writes nothing and exits 0 with a gate status noting the earlier pass

#### Scenario: execute with skip-verify

- **WHEN** the user types `/bdk:execute --skip-verify`
- **THEN** the kernel writes one `transition` with `to: execute`, `source: kernel` and `skip-verify: true`, and a second identical command writes nothing

#### Scenario: tiny has no design gate

- **WHEN** the Change is `tiny` and the user types `/bdk:plan`
- **THEN** the kernel writes a plain `transition` with `to: plan` and `source: kernel` and exits 0

#### Scenario: run passes an auto gate

- **WHEN** `policy.gates.design` is `auto`, `gate:design` is ready and the user types `/bdk:run`
- **THEN** the kernel writes one `transition` with `source: policy` and `gate: gate:design`, and `gate:design` is done with `passedBy: policy`

#### Scenario: run leaves a manual gate

- **WHEN** `policy.gates.design` is `manual`, `gate:design` is ready and the user types `/bdk:run`
- **THEN** the kernel writes nothing, exits 0, and stdout names `/bdk:plan` as the command the user types

## ADDED Requirements

### Requirement: Guard hooks file and prefilter

`hooks/hooks.json` SHALL register the two guards and the session-end hook as below, and the `PreToolUse` guard SHALL start Node only when the shell prefilter finds the payload can be affected.

| Event                 | Matcher                                      | Command                                                                                                                                                          |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse`          | `^(Bash\|Edit\|Write\|NotebookEdit\|Agent)$` | the guard form below with `pre-tool.sh`                                                                                                                          |
| `UserPromptExpansion` | `^bdk:(plan\|execute\|close\|run)$`          | the guard form below with `prompt-expansion.sh`                                                                                                                  |
| `SessionEnd`          | none                                         | `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-end 2>&1 \|\| echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."` |

The guard form sources the script into the shell the host already starts, so a payload the prefilter drops costs no second process, and checks first that the script is readable, because a failing `.` ends some shells with exit 1, which the host would treat as a non-blocking error:

```sh
f="${CLAUDE_PLUGIN_ROOT}/hooks/guard/<script>"; [ -r "$f" ] || { echo "guard/kernel-unavailable: $f is missing, so BDK cannot check <what>; reinstall the BDK plugin" >&2; exit 2; }; . "$f"
```

The matchers are anchored because the host tests a matcher with other characters than letters, digits, `_`, `-`, `|`, `,` and spaces as an unanchored regular expression (hooks reference, matchers). `MultiEdit` is left out: the host has no such tool (HOST-FACTS `input-multiedit`). The `Agent` matcher follows HOST-FACTS `agent-tool-name`.

Both guard scripts are POSIX `sh`, read the payload from stdin once, check before starting the kernel (in `pre-tool.sh` after the prefilter) that `node` is on `PATH` and `dist/bdk.mjs` exists (otherwise `guard/kernel-unavailable: ...` on stderr and exit 2), and end with one kernel line that matches the `guard-wrapper` regex of `kernel-cli`, Output modes, feeding the payload on stdin. `pre-tool.sh` calls the kernel only when the raw payload contains one of: `.bdk/specs`; `bdk.mjs` and `hooks`; `/bdk:`; `"agent_id"` and either `git` or `bdk.mjs`; `bdk:reader`, `bdk:reviewer` or `bdk:scout`; `"subagent_type"` and either `bdk:worker` or `bdk:runner`. Otherwise it exits 0 without starting Node. The prefilter only over-approximates: whatever it lets through, the kernel decides from the parsed payload.

#### Scenario: hooks file entries

- **WHEN** `hooks/hooks.json` is inspected
- **THEN** it holds exactly the `SessionStart` entry of `plugin-tooling` and the three entries above, and each guard script's kernel line matches `guard-wrapper`

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

### Requirement: Pre-tool command reading

`hooks pre-tool` SHALL read a Bash command as a list of simple commands, each with its words and output redirections, and apply the Bash guards to command words, never to the raw text.

The reader handles single and double quotes, backslash escapes, `#` comments at a word start, heredocs (`<<EOF`, `<<-EOF`, `<<'EOF'`; the body up to the delimiter line is skipped), the separators `;`, `&&`, `||`, `|`, `&` and newlines, and `(`, `)`, `{`, `}` as grouping; `$(...)` and backticks stay inside their word. A simple command whose command word is `sh`, `bash`, `zsh` or `dash` with `-c <string>`, or `eval`, is read again from its string, three levels deep. The command word is the first word after variable assignments and the wrappers `env` (with its options and assignments), `command`, `exec`, `time`, `nice`, `nohup` and `sudo`, compared by basename.

- A **git command** has the command word `git`; its verb is the first word after git's global options (`-C <path>`, `-c <k=v>`, `--git-dir[=]<d>`, `--work-tree[=]<d>`, `--no-pager`, `-P`, `--no-optional-locks`, `--literal-pathspecs`).
- A **kernel command** has a word whose basename is `bdk.mjs` as its command word or after `node` and node's options; its verb is resolved from the following words against the bundled command index, exactly as the kernel dispatches.
- A **write** is an output redirection (`>`, `>>`, `>|`, `&>`, `&>>`, `<n>>`) to anything but `/dev/null`, `/dev/stdout`, `/dev/stderr` or a file descriptor, or the target of a writing command: `tee` (its file arguments), `sed` and `perl` with `-i` or `--in-place` (their file arguments), `cp` and `install` (the last argument), `mv`, `rm`, `rmdir`, `touch`, `mkdir`, `ln`, `truncate`, `chmod`, `chown` (every argument that is not an option), `dd` (`of=`), `git apply`.

The reader is best effort for a careless model (design NFR "Security"): an interpreter (`python -c`, `node -e`), a script file, an alias or a function can still hide a verb or a write.

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

### Requirement: Pre-tool guards

`hooks pre-tool` SHALL decide each tool call with the guards below; a subagent is a payload with `agent_id` (HOST-FACTS `agent-fg`, `agent-bg`, `main-no-agent-id`).

- **Spec directory** (V1-7, every thread): an `Edit`, `Write` or `NotebookEdit` whose `file_path` or `notebook_path`, relative to the project root, lies under `.bdk/specs/`, or a Bash write whose target lies under `.bdk/specs/`, is denied with `guard/spec-dir-write`. Reading a spec passes.
- **Hooks from Bash** (T1, every thread): a kernel command whose verb is a `hook` class command is denied with `guard/hooks-from-bash`.
- **Nested stage command** (T1, every thread): a simple command with the command word `claude` and a word starting with `/bdk:plan`, `/bdk:execute`, `/bdk:close` or `/bdk:run` is denied with `guard/nested-stage-command`.
- **Subagent git** (T3): a git command whose verb is `stash`, `reset`, `clean`, `restore`, `commit`, `add`, `merge`, `rebase`, `cherry-pick` or `push`; `checkout` with `--`, a `.` argument, `-f` or `--force`; `switch` with `--discard-changes`, `-f` or `--force`. Denied with `guard/subagent-git`. `git checkout <branch>`, `git status`, `git diff` and `git log` pass.
- **Subagent kernel command** (T3): a kernel command whose verb is an `orchestrator` class command is denied with `guard/subagent-kernel-command`; `agent` and `read` verbs, `--help` and unknown verbs pass.
- **Read-only adapters** (T23-D14, D20): a Bash write from a payload whose `agent_type` is `bdk:reader`, `bdk:reviewer` or `bdk:scout` is denied with `guard/reader-write`.
- **Dispatch prompt** (T23-D0): an `Agent` call whose `subagent_type` is `bdk:worker`, `bdk:reader`, `bdk:reviewer`, `bdk:runner` or `bdk:scout` is denied with `guard/dispatch-prompt` unless its prompt holds exactly one path matching `(^|/)\.bdk/changes/[^/\s]+/dispatch/[^/\s]+\.md` and, without that path, at most one sentence: no blank line, at most one sentence end, at most 200 characters. Other `subagent_type` values pass.

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

### Requirement: Gate acceptance through recorded payloads

The T24 acceptance signal SHALL pass end to end through `dist/bdk.mjs` on a fixture repository, driven by the recorded payloads of T01 with the placeholders replaced.

#### Scenario: typed command passes the gate

- **WHEN** a `small` Change has `design` and `architecture` done and the recorded `upe-typed.json` payload with `command_name: bdk:plan` arrives
- **THEN** the exit code is 0, the ledger holds one `transition` with `source: user`, `gate: gate:design`, `session` and `command` from the payload, and `bdk next --json` no longer waits for `gate:design`

#### Scenario: payload without the user marker

- **WHEN** the same payload arrives without `expansion_type`
- **THEN** the exit code is 2 and the ledger holds no new entry

#### Scenario: plan typed before the design is ready

- **WHEN** `design` is not done and the `/bdk:plan` payload arrives
- **THEN** the exit code is 2, stderr starts with `policy/gate-not-ready` and names `design`, and the ledger holds no new entry

#### Scenario: log entry cannot pass the gate

- **WHEN** `bdk log add decision "Design approved" --ref gate:design` runs while `gate:design` is ready
- **THEN** `gate:design` stays not done until the `/bdk:plan` payload arrives

### Requirement: Guard latency

The guards SHALL stay within the NFR "Latency" budgets, measured locally through the bundle in the `perf` test project (`pnpm test:perf`), which CI does not run.

On a fixture of 750 recorded-shape `PreToolUse` payloads (main-thread and subagent Bash, edit tools, `Agent` calls, a project path containing `git`): on a payload the prefilter drops, the p95 of the time the guard adds over a bare `sh -c` reading the same payload is under 5 ms; the p95 of a `pre-tool` call that reaches the kernel is under 150 ms; the p95 of `prompt-expansion` on a typed stage command that writes its transition is under 150 ms.

#### Scenario: latency budgets

- **WHEN** `pnpm test:perf` runs the guard benchmarks
- **THEN** each p95 is under its budget, and the report names the three values
