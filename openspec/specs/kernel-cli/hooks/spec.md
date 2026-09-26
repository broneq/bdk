# kernel-cli/hooks Specification

## Purpose

Host hooks (`hooks`). The five entry points the host calls (hooks table, HOST-FACTS). Content hooks and `skill-exists` are inject mode; `prompt-expansion` and `pre-tool` are guard mode. Payloads and stdout shapes are in `kernel-cli/hooks`, Hook payloads.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "guard/subagent-kernel-command",
  "why": "subagent <AGENT-1> invoked bdk.mjs commit 02-3; commit is an orchestrator command",
  "instead": [
    "return blocked with the cause; the orchestrator commits",
    "bdk log add blocker \"...\" --ref 02-3 --ticket A-7f3k"
  ]
}
```

## Requirements

### Requirement: bdk hooks session-start

SessionStart content hook: STARTUP text, configuration check, v2 layout detection, schema refresh. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-start`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionStart payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** One process instead of the three v2 SessionStart commands (a static `cat` of STARTUP, the rule-drift snapshot, `config check`). It prints the output of `ctx startup` first. In a BDK project (a `.bdk/` directory at the project root) it then runs the validation of `config check`, which also refreshes the resolved snapshot and the offline schema copy under `.bdk/.machine/`, and the v2 layout detection of `doctor`. Every problem becomes a line after the STARTUP text: an error of the configuration (an unknown key, a removed v2 key with its replacement or reason, an invalid value, an unreadable file) is one line `[BDK] config: <why> Instead: <instead joined by "; ">`, a warning of `config check` is one line `[BDK] config warning: <path>: <message>` (except `legacy-settings`, which the layout line already names), and a v2 layout is one line `[BDK] v2 layout detected (<paths>): run bdk import.` A configuration problem is content, never a STOP block, because it must not make the model stop at session start. Outside a BDK project, and outside a git work tree (a standalone command, `kernel-cli`, Invocation), it prints the STARTUP text alone. The hook starts no MCP server and registers no code graph (ADR-0001). The payload is read and ignored in T13; `source` becomes relevant with T24. Inject mode: exits 0 always, and only an internal failure is a STOP block.
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

### Requirement: bdk hooks session-end

SessionEnd content hook: Change checkpoint commit when enabled and safe. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-end`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionEnd payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Calls `change checkpoint` with the same skips (rebase / merge / cherry-pick in progress, open tickets, policy off). Fires on `/clear`, `/exit`, SIGTERM and after every headless run (HOST-FACTS `end-clear`, `end-exit`, `end-term`, `end-headless`), never after SIGKILL (`end-kill`), so recovery never assumes it ran. The payload field is `reason` as recorded (HOST-FACTS `end-payload`).
- **Writes:** `git:commit`
- **Output:** `schema/cli/output/hooks-session-end.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: `policy/git-in-progress`, `policy/ticket-open`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks session-end
  ```

  ```json
  {
    "content": "",
    "reason": "prompt_input_exit",
    "checkpoint": {
      "done": false,
      "skipped": "open tickets"
    }
  }
  ```

- **Owner:** T24
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks session-end` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/hooks-session-end.json`

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress (V1-4)
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/git-in-progress`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/ticket-open`

### Requirement: bdk hooks prompt-expansion

UserPromptExpansion guard: the only writer of `source: user` stage transitions. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks prompt-expansion`
- **Availability:** `hook`
- **Mode:** `guard`; Change-scoped
- **Arguments:**
  - stdin: UserPromptExpansion payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Resolves the Change from the branch, calls `next`, and for a typed `/bdk:plan` or `/bdk:close` with the gate ready writes the `source: user` transition entry (kernel clock, `session_id`, command text, `refs` = the gate node and its gated artifacts); for `/bdk:execute` writes a plain stage transition carrying `--skip-verify` when `command_args` contains it (P2); for `/bdk:run` walks the stages under `policy.gates.<gate>: auto` writing `source: policy` (T02 decision R-9). Outcomes: gate ready -> pass and write; gate not ready -> block "gate not ready: <what is missing>"; gate already done -> pass without writing (S5); no gate in the profile -> pass with a plain stage entry; no active Change -> block with the hint; kernel missing -> the shell's `|| exit 2` blocks with "kernel unavailable". On pass, stdout is the gate status as plain text, which the host prepends to the skill's prompt. `command_name` arrives namespaced (`bdk:plan`, HOST-FACTS `upe-name`) and a nested `claude -p "/bdk:plan"` counts as user-typed (`upe-headless`).
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
    "entry": "L-g5h2j",
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

### Requirement: bdk hooks pre-tool

PreToolUse guard: spec directory, subagent git, subagent kernel commands, `bdk.mjs hooks` from Bash. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks pre-tool`
- **Availability:** `hook`
- **Mode:** `guard`
- **Arguments:**
  - stdin: PreToolUse payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Reached only after the shell prefilter (T24): Bash with `agent_id` and text containing `git` or `bdk.mjs`, any thread with `.bdk/specs` or `bdk.mjs hooks`, edit tools with a path under `.bdk/specs/` read from `tool_input.file_path` or `notebook_path` (HOST-FACTS `input-notebookedit`); `MultiEdit` does not exist (`input-multiedit`). Denied git verbs: `stash`, `reset`, `clean`, `checkout -- <path>`, `checkout .`, `restore`, `switch --discard-changes`, `commit`, `add`, `merge`, `rebase`, `cherry-pick`, `push`. Denied kernel commands: every `orchestrator` and `hook` verb of `kernel-cli`, Availability classes. On deny the kernel prints the host's `permissionDecision: deny` JSON with the reason and exits 2 (stderr carries the same reason). Main-thread git is never touched. The user's own `!` bash-mode commands do not pass through this hook (HOST-FACTS `bang-pretool`), a known gap.
- **Writes:** nothing
- **Output:** `schema/cli/output/hooks-pre-tool.json` for `--json` (the kernel's own decision record, used by tests); the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `guard/spec-dir-write`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/hooks-from-bash`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks pre-tool --json
  ```

  ```json
  {
    "decision": "deny",
    "rule": "guard/subagent-git",
    "verb": "git stash",
    "reason": "subagents may not run git stash; return blocked with the cause instead of reverting (BDK T3)",
    "agentId": "<AGENT-1>"
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

### Requirement: bdk hooks skill-exists

Skill-frontmatter UserPromptSubmit hook: warn as content when a named skill is not installed. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks skill-exists <name>`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - `<name>` (required). Skill name as in frontmatter, e.g. caveman-commit.
  - stdin: UserPromptSubmit payload; only the presence of a name matters.
- **Behaviour:** Replaces `hooks/is-skill-exist/check.py`. Looks for a `SKILL.md` whose frontmatter `name` equals `<name>` in `skills/*/` under `~/.claude/`, under the project root's `.claude/`, under every marketplace directory `~/.claude/plugins/marketplaces/*/` and under every installed plugin version `~/.claude/plugins/cache/*/*/*/`. The last root is new: a plugin whose marketplace repository does not hold the skill at its root was reported missing by the v2 script. It relies only on the directory layout, never on the host's plugin bookkeeping files. Installed: stdout is empty. Missing: stdout is one line `[BDK] skill <name> is not installed; the skill that needs it falls back to its own behaviour.` Inject mode: exits 0 in both cases; a missing skill is a content line, never a block. Plugin-level and skill-level hooks are supported by the host; only agent-level hooks are stripped.
- **Writes:** nothing
- **Output:** `schema/cli/output/hooks-skill-exists.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk hooks skill-exists caveman-commit --json
  ```

  ```json
  {
    "name": "caveman-commit",
    "installed": false,
    "content": "[BDK] skill caveman-commit is not installed; the skill that needs it falls back to its own behaviour."
  }
  ```

- **Owner:** T13
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `bdk hooks skill-exists caveman-commit --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/hooks-skill-exists.json`

#### Scenario: skill of an installed plugin

- **WHEN** `~/.claude/plugins/cache/caveman/caveman/2.7.0/skills/caveman-commit/SKILL.md` has `name: caveman-commit` and `bdk hooks skill-exists caveman-commit --json` runs
- **THEN** `installed` is true, `foundIn` names that file and `content` is empty

#### Scenario: missing skill

- **WHEN** no search root holds a skill named `caveman-commit`
- **THEN** the exit code is 0 and stdout is the one `[BDK] skill caveman-commit is not installed` line

### Requirement: Hook payloads

The `hooks` group SHALL read the host's JSON payload from stdin and answer in the shape the host expects for that event.

The `hooks` group reads the host's JSON payload from stdin and answers in the shape the host expects for that event (Claude Code hooks reference, "Hook input" and "Hook output"). Field names below are the recorded ones: every payload cited here is in `tests/fixtures/host-payloads/2.1.281/` (T01), with machine-specific values replaced by placeholders. Where no recording exists the row says so and T24 records one before relying on the field. Common input fields on every event: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and `permission_mode` on every event except `SessionEnd` (HOST-FACTS `end-payload`). The kernel ignores fields it does not list.

| Command                     | Event                                                           | Fixture                                                                                                                                                                                       | Input fields the kernel reads                                                                                                                                                                                                   | stdout on pass (exit 0)                                                                                                                        | Block                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks session-start`       | `SessionStart`                                                  | none in 2.1.281 (T24 records `session-start.json`; the field list is from the hooks reference)                                                                                                | `source` (`startup`, `resume`, `clear`, `compact`), `cwd`                                                                                                                                                                       | The STARTUP Markdown, prepended to the session context by the host. A configuration problem or a v2 layout is a line inside that Markdown.     | Never. Inject mode: exit 0 always.                                                                                                                                                |
| `hooks session-end`         | `SessionEnd`                                                    | `session-end-clear.json` (`reason: "clear"`), `session-end-term.json` (`reason: "other"`), `upe-typed.json` (`reason: "prompt_input_exit"`)                                                   | `reason`                                                                                                                                                                                                                        | Empty, or one line naming the checkpoint commit. The host shows nothing from this event.                                                       | Never; the event cannot block. Fires on `/clear`, `/exit`, headless end and SIGTERM, not on SIGKILL (HOST-FACTS `end-clear`, `end-exit`, `end-headless`, `end-term`, `end-kill`). |
| `hooks prompt-expansion`    | `UserPromptExpansion`                                           | `upe-typed.json` (interactive), `allowed.json` (headless `claude -p`)                                                                                                                         | `command_name` (namespaced, `bdk:plan`; HOST-FACTS `upe-name`), `command_args` (raw string, `""` when empty; `--skip-verify` is parsed from it, P2), `command_source` (`plugin`), `prompt`, `expansion_type` (`slash_command`)  | Plain text: the gate status (the gate, what passed it, the pending `review: true` entries). The host prepends it to the expanded skill prompt. | Exit 2 with the reason on stderr; the host shows it and does not run the skill.                                                                                                   |
| `hooks pre-tool`            | `PreToolUse`                                                    | `pre-bash.json` (main thread, no `agent_id`), `agent-fg.json` and `agent-bg.json` (subagent, `agent_id` and `agent_type` present), `pre-write.json`, `pre-edit.json`, `pre-notebookedit.json` | `tool_name`, `tool_input.command` (Bash), `tool_input.file_path` (Write, Edit), `tool_input.notebook_path` (NotebookEdit; HOST-FACTS `input-notebookedit`), `agent_id` (presence means subagent; HOST-FACTS `main-no-agent-id`) | Nothing: an empty stdout with exit 0 lets the host apply its normal permission flow.                                                           | Exit 2, the reason on stderr, and on stdout the host's decision object (below).                                                                                                   |
| `hooks skill-exists <name>` | `UserPromptSubmit` (declared in a skill's frontmatter `hooks:`) | none in 2.1.281 (T24 records `skill-exists.json`)                                                                                                                                             | none; the name comes from the command line, the payload only proves the event                                                                                                                                                   | One line of context when the skill is missing, empty when installed.                                                                           | Never. Inject mode.                                                                                                                                                               |

`hooks pre-tool` block, printed on stdout exactly as the host expects it (hooks reference, `PreToolUse` decision control), with the same text on stderr:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "guard/subagent-git: subagents may not run git stash; return blocked with the cause instead of reverting (BDK T3)"
  }
}
```

The reason always starts with the rule id, then names the verb or path, then the instruction. The kernel never answers `allow` or `ask`: a pass is silence, so that the host's own permission rules stay in force.

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

`hooks prompt-expansion` SHALL produce exactly the six outcomes below.

The six outcomes of the design's hooks table, with the host behaviour they rely on (HOST-FACTS `upe-fires`, `upe-fields`, `upe-headless`):

| Situation                                                                                   | Exit | Writes                                                                                                                                          | stdout / stderr                                                                                  |
| ------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Stage command whose gate is ready (`/bdk:plan` after `design`, `/bdk:close` after `review`) | 0    | `transition` entry with `source: user`, the kernel clock, `session_id`, the command text and `refs` to the gate node and the artifacts it gates | stdout: gate status as plain text                                                                |
| Gate not ready                                                                              | 2    | nothing                                                                                                                                         | stderr: `policy/gate-not-ready: <what is missing>`; the skill does not run                       |
| Gate already done (the user retyped the command, or resumes on another machine, S5)         | 0    | nothing                                                                                                                                         | stdout: gate status noting the earlier pass                                                      |
| Stage command without a gate in this profile (`/bdk:execute`, or `tiny` skipping `design`)  | 0    | plain `transition` entry (`source: kernel`), carrying `skipVerify: true` when `command_args` contains `--skip-verify`                           | stdout: the stage line                                                                           |
| `/bdk:run` with `policy.gates.<gate>: auto`                                                 | 0    | `transition` entries with `source: policy` for each auto gate crossed (T02 decision R-9)                                                        | stdout: the gates passed by policy, so the user sees them                                        |
| No active Change on the branch                                                              | 2    | nothing                                                                                                                                         | stderr: `policy/no-active-change: ...; run /bdk:change new "<intent>" or bdk change resume <id>` |

A non-BDK command (`command_name` without the `bdk:` prefix) or a non-stage BDK skill passes with empty stdout and no write. A nested `claude -p "/bdk:plan"` started from a tool call arrives as a user prompt (HOST-FACTS `upe-headless`); whether `hooks pre-tool` denies `claude` invocations from tool calls is T24's decision, recorded there. The user's own `!` bash-mode commands do not pass through `PreToolUse` at all (HOST-FACTS `bang-pretool`), a known gap of the spec and command guards.

#### Scenario: gate ready

- **WHEN** the user types `/bdk:plan` and `gate:design` is ready
- **THEN** the kernel writes one `transition` entry with `source: user` and exits 0 with the gate status on stdout

#### Scenario: gate not ready

- **WHEN** the user types `/bdk:plan` and `gate:design` is not ready
- **THEN** the kernel writes nothing and exits 2 with `policy/gate-not-ready: <what is missing>` on stderr

#### Scenario: gate already done

- **WHEN** the user retypes a stage command whose gate is already done
- **THEN** the kernel writes nothing and exits 0 with a gate status noting the earlier pass
