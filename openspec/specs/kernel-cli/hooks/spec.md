# kernel-cli/hooks Specification

## Purpose

Host hooks (`hooks`). The nine entry points the host calls (hooks table, HOST-FACTS). Content hooks, `skill-exists` and the agent hooks (`post-tool`, `subagent-start`, `subagent-stop`, `stop`) are inject mode; `prompt-expansion` and `pre-tool` are guard mode. Payloads and stdout shapes are in `kernel-cli/hooks`, Hook payloads.

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
- **Behaviour:** One process instead of the three v2 SessionStart commands (a static `cat` of STARTUP, the rule-drift snapshot, `config check`). It prints the output of `ctx startup` first. In a BDK project it ends, as `stale`, the registry rows of other sessions whose agents have been silent for longer than `agents.ttl` (`kernel-state`, Agent registry), so a crashed session leaves no agent `running`. In a BDK project (a `.bdk/` directory at the project root) it then runs the validation of `config check`, which also refreshes the resolved snapshot and the offline schema copy under `.bdk/.machine/`, and the v2 layout detection of `doctor`. Every problem becomes a line after the STARTUP text: an error of the configuration (an unknown key, a removed v2 key with its replacement or reason, an invalid value, an unreadable file) is one line `[BDK] config: <why> Instead: <instead joined by "; ">`, a warning of `config check` is one line `[BDK] config warning: <path>: <message>` (except `legacy-settings`, which the layout line already names), and a v2 layout is one line `[BDK] v2 layout detected (<paths>): run /bdk:setup.` A role that would read more rules than `rules.warn-above` (`kernel-settings`, Keys of rules and specs) is one line `[BDK] rules warning: <role> reads <n> rules (rules.warn-above: <limit>); switch rules off with rules.disabled or narrow them with applies.`, counted as `rules explain` selects them for the project's `languages` with no file set, so every scoped rule counts; one line names the role with the most rules. There is no cap on the rules a package carries, so this line is how a user learns the prompts grew; rule files that fail `rules check` are left to `doctor` and add no line here. A configuration problem is content, never a STOP block, because it must not make the model stop at session start. Outside a BDK project, and outside a git work tree (a standalone command, `kernel-cli`, Invocation), it prints the STARTUP text alone. The hook starts no MCP server and registers no code graph (ADR-0001). The payload is read and ignored in T13; `source` becomes relevant with T24. Inject mode: exits 0 always, and only an internal failure is a STOP block.
- **Writes:** `.bdk/.machine/`
- **Output:** `schema/cli/output/hooks-session-start.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; configuration problems are content lines, not rules; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks session-start --json
  ```

  ```json
  {
    "content": "# BDK Shared Foundation\n...\n\n[BDK] v2 layout detected (.bdk/settings.json): run /bdk:setup.",
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

### Requirement: bdk hooks session-end

SessionEnd content hook: Change checkpoint commit when enabled and safe, and the end of the session's run. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-end`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionEnd payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Resolves the active Change of the branch and runs the `shared/store` checkpoint core that `change checkpoint` uses (`kernel-loops`, Checkpoint). Every outcome other than a commit is reported, never refused: `checkpoint.done` is false and `skipped` is `no active Change` or the reason the checkpoint core reports, as `change park` reports it (the disabled policy, nothing changed under the Change directory, the rebase, merge or cherry-pick in progress, the open tickets by id, the git hook's output), because the host ignores this event's output and exit code (hooks reference, `SessionEnd`) and implicit checkpoint callers report skips (T22). Content is empty, or one line `[BDK] checkpoint <sha7> of <change>` after a commit. Fires on `/clear`, `/exit`, SIGTERM and after every headless run (HOST-FACTS `end-clear`, `end-exit`, `end-term`, `end-headless`), never after SIGKILL (`end-kill`), so recovery never assumes it ran. The payload field is `reason` as recorded (HOST-FACTS `end-payload`), echoed in the output; an unreadable payload is ignored, since the checkpoint does not depend on it. Before the checkpoint it removes the session's run marker (`kernel-state`, Run marker) when the payload carries a `session_id` and the marker exists, with or without an active Change; a failed removal is ignored, because the event cannot block.
- **Writes:** `git:commit`, `.bdk/.machine/runs/`
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

#### Scenario: run marker removed

- **WHEN** the user typed `/bdk:run --auto "<intent>"` in session `S1` and the `SessionEnd` payload of `S1` arrives
- **THEN** the exit code is 0 and `.bdk/.machine/runs/S1.json` no longer exists, while the marker of another session stays

### Requirement: bdk hooks prompt-expansion

UserPromptExpansion guard: the only writer of `source: user` stage transitions and the start of a run. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks prompt-expansion`
- **Availability:** `hook`
- **Mode:** `guard`; Change-scoped
- **Arguments:**
  - stdin: UserPromptExpansion payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Parses the payload first. A `command_name` outside the `bdk:` namespace, or a BDK skill that is neither a pipeline stage command nor `run`, passes with empty stdout and no Change lookup. For a stage command it checks the user-typed marker (Prompt-expansion outcomes), resolves the Change from the branch, reads the graph once and applies the outcomes of Prompt-expansion outcomes: gate ready -> pass and write `source: user`; gate not ready -> block naming what is missing; gate already done -> pass without writing (S5); no gate in the profile -> pass with a plain stage entry, carrying `skip-verify` for `/bdk:execute` when `command_args` holds the token `--skip-verify` (P2); `/bdk:run` -> the session's run marker and `source: policy` entries for the ready gates that resolve to `auto`, every ready gate with `--auto` (T02 decision R-9, T41); `/bdk:run <intent>` without an active Change -> the marker only; a typed `/bdk:plan`, `/bdk:execute` or `/bdk:close` removes the session's run marker before its outcome; no active Change -> block with the hint; kernel missing -> the guard script blocks with `guard/kernel-unavailable`. On pass, stdout is the gate status as plain text, which the host adds to the skill's context. `command_name` arrives namespaced (`bdk:plan`, HOST-FACTS `upe-name`) and a nested `claude -p "/bdk:plan"` counts as user-typed (`upe-headless`), which `hooks pre-tool` denies from tool calls (`guard/nested-stage-command`). The record is Change-scoped, but its registration asks the registry to leave the resolution to the handler, which resolves the Change only for a stage command, so a non-stage command passes without one.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/.machine/runs/`
- **Output:** `schema/cli/output/hooks-prompt-expansion.json` for `--json` (the kernel's own decision record, used by tests); the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `policy/gate-not-ready`, `policy/change-exists`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
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

#### Scenario: policy/change-exists

- **WHEN** the user types `/bdk:run "Add a notification list"` on a branch whose active Change is `2026-10-02-login`
- **THEN** the exit code is 2, nothing is written, and the reason on stderr starts with `policy/change-exists` and names `/bdk:run` without an intent

### Requirement: bdk hooks pre-tool

PreToolUse guard: spec directory, subagent git, subagent kernel commands, `bdk.mjs hooks` from Bash, agent spawns, agent messages, and stage skills a model starts. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks pre-tool`
- **Availability:** `hook`
- **Mode:** `guard`; standalone (`kernel-cli`, Invocation): the guards read only the payload, so a tool call outside a git work tree is decided, not blocked with `runtime/not-a-repo`. The one exception is a `Skill` call to a guarded stage skill inside a run, which reads the session's run marker and resolves the Change from the branch (Pre-tool guards, Stage skill)
- **Arguments:**
  - stdin: PreToolUse payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Reached only after the shell prefilter (Guard hooks file and prefilter). Reads a Bash command through the command reader (Pre-tool command reading) and applies the guards of Pre-tool guards in this order: `guard/spec-dir-write`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/lead-scope`, `guard/worktree-scope`, `guard/reader-write`, `guard/dispatch-prompt`, `guard/agent-spawn`, `guard/escalation-model`, `guard/agent-message`, `guard/stage-skill`, then for a `Skill` call admitted inside a run the stage's gate (`policy/gate-not-ready`, `guard/gate-manual`); the first match denies. An admitted stage skill writes what a typed stage command writes (Prompt-expansion outcomes), with `source: policy` for its gate and the run's typed prompt as `command`. A `SendMessage` that passes and names an agent the registry holds is recorded as a message for that agent (`kernel-state`, Agent registry), which `agents wait` returns. Denied kernel commands: every `orchestrator` and `hook` verb of `kernel-cli`, Availability classes, matched by exact verb. On deny the kernel prints the host's `permissionDecision: deny` JSON with the reason and exits 2 (stderr carries `<rule>: <reason>`). Main-thread git is never touched. The user's own `!` bash-mode commands do not pass through this hook (HOST-FACTS `bang-pretool`), a known gap. A payload that is not JSON, or lacks `tool_name` or `tool_input`, is blocked with `input/invalid-argument`.
- **Writes:** `.bdk/.machine/agents.sqlite`, `.bdk/.machine/runs/`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/hooks-pre-tool.json` for `--json` on pass (the kernel's own decision record, used by tests); the error object on a block under `--json`; the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `guard/spec-dir-write`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/lead-scope`, `guard/worktree-scope`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/dispatch-prompt`, `guard/reader-write`, `guard/agent-spawn`, `guard/escalation-model`, `guard/agent-message`, `guard/stage-skill`, `guard/gate-manual`, `policy/gate-not-ready`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
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

#### Scenario: guard/worktree-scope

- **WHEN** an implementer whose active package carries `workdir: /repo/.bdk/.machine/worktrees/<id>/02` sends `Edit` of `/repo/src/api/http.ts`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/worktree-scope`

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

#### Scenario: guard/stage-skill

- **WHEN** the main thread calls `Skill` with `skill: bdk:execute` in a session that has no run marker
- **THEN** the exit code is 2, nothing is written, and the reason on stderr starts with `guard/stage-skill` and names `/bdk:execute`

#### Scenario: guard/gate-manual

- **WHEN** a run without `--auto` calls `Skill` with `skill: bdk:plan`, `gate:design` is ready and `policy.gates.design` is `manual`
- **THEN** the exit code is 2, nothing is written, and the reason on stderr starts with `guard/gate-manual` and names `/bdk:plan`

#### Scenario: policy/gate-not-ready

- **WHEN** a run calls `Skill` with `skill: bdk:plan` while `design` is not done
- **THEN** the exit code is 2, nothing is written, and the reason on stderr starts with `policy/gate-not-ready` and names `design`

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

The `hooks` group reads the host's JSON payload from stdin and answers in the shape the host expects for that event (Claude Code hooks reference, "Hook input" and "Hook output"). Field names below are the recorded ones: every payload cited here is in `tests/fixtures/host-payloads/2.1.281/` (T01) or, for the agent events, `tests/fixtures/host-payloads/2.1.284/` (T41), with machine-specific values replaced by placeholders. Where no recording exists the row says so. Common input fields on every event: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and `permission_mode` on every event except `SessionEnd` (HOST-FACTS `end-payload`). The kernel ignores fields it does not list.

| Command                     | Event                                                           | Fixture                                                                                                                                                                                                                                                                                                            | Input fields the kernel reads                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | stdout on pass (exit 0)                                                                                                                                                    | Block                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks session-start`       | `SessionStart`                                                  | none in 2.1.281 (the field list is from the hooks reference)                                                                                                                                                                                                                                                       | `source` (`startup`, `resume`, `clear`, `compact`), `cwd`; read by no behaviour yet                                                                                                                                                                                                                                                                                                                                                                                                                     | The STARTUP Markdown, prepended to the session context by the host. A configuration problem or a v2 layout is a line inside that Markdown.                                 | Never. Inject mode: exit 0 always.                                                                                                                                                |
| `hooks session-end`         | `SessionEnd`                                                    | `session-end-clear.json` (`reason: "clear"`), `session-end-term.json` (`reason: "other"`), `upe-typed.json` (`reason: "prompt_input_exit"`)                                                                                                                                                                        | `reason`, `session_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Empty, or one line naming the checkpoint commit. The host shows nothing from this event.                                                                                   | Never; the event cannot block. Fires on `/clear`, `/exit`, headless end and SIGTERM, not on SIGKILL (HOST-FACTS `end-clear`, `end-exit`, `end-headless`, `end-term`, `end-kill`). |
| `hooks prompt-expansion`    | `UserPromptExpansion`                                           | `upe-typed.json` (interactive), `allowed.json` (headless `claude -p`)                                                                                                                                                                                                                                              | `hook_event_name`, `session_id`, `command_name` (namespaced, `bdk:plan`; HOST-FACTS `upe-name`), `command_args` (raw string, `""` when empty; `--skip-verify` is an exact token of it, P2; `command_input`, the hooks reference's name, when `command_args` is absent), `expansion_type` (`slash_command`), `prompt`                                                                                                                                                                                    | Plain text: the gate status (the gate, what passed it, the pending `review: true` entries). The host adds it to the expanded skill's context.                              | Exit 2 with `<rule>: <why>` on stderr; the host shows it and does not run the skill.                                                                                              |
| `hooks pre-tool`            | `PreToolUse`                                                    | `pre-bash.json` (main thread, no `agent_id`), `agent-fg.json` and `agent-bg.json` (subagent, `agent_id` and `agent_type` present), `pre-write.json`, `pre-edit.json`, `pre-notebookedit.json`, `agent-fg.json` (`Agent`), `send-live-id.json` (`SendMessage`), `pre-skill.json` (`Skill`, recorded by this Change) | `tool_name`, `tool_input.command` (Bash), `tool_input.file_path` (Write, Edit), `tool_input.notebook_path` (NotebookEdit; HOST-FACTS `input-notebookedit`), `tool_input.subagent_type` and `tool_input.prompt` (Agent; HOST-FACTS `agent-tool-name`), `tool_input.to` and `tool_input.message` (SendMessage), `agent_id` (presence means subagent; HOST-FACTS `main-no-agent-id`), `agent_type`, `cwd`, `session_id`, `tool_input.skill` and `tool_input.args` (Skill; HOST-FACTS `skill-tool-pretool`) | Nothing: an empty stdout with exit 0 lets the host apply its normal permission flow.                                                                                       | Exit 2, `<rule>: <reason>` on stderr, and on stdout the host's decision object (below).                                                                                           |
| `hooks post-tool`           | `PostToolUse`                                                   | `lifecycle-bg.json` (`Agent`, `status: async_launched`), `lifecycle.json` (`Agent`, `status: completed`), `stop-kill.json` (`TaskStop`)                                                                                                                                                                            | `tool_name`, `agent_id` (absent for the main thread), `tool_input.prompt` (Agent), `tool_response.agentId` and `tool_response.status` (Agent), `tool_input.task_id` and `tool_response.task_type` (TaskStop)                                                                                                                                                                                                                                                                                            | Nothing.                                                                                                                                                                   | Never; the tool has already run.                                                                                                                                                  |
| `hooks subagent-start`      | `SubagentStart`                                                 | `lifecycle-bg.json`, `inject-id.json`                                                                                                                                                                                                                                                                              | `agent_id`, `agent_type`, `session_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The host's `hookSpecificOutput` with `hookEventName: SubagentStart` and `additionalContext` (HOST-FACTS `start-context`), for a `bdk:` agent type only; nothing otherwise. | Never; the event cannot block.                                                                                                                                                    |
| `hooks subagent-stop`       | `SubagentStop`                                                  | `lifecycle.json`, `subagent-stop-block.json`                                                                                                                                                                                                                                                                       | `agent_id`, `agent_type`, `stop_hook_active`, `background_tasks`                                                                                                                                                                                                                                                                                                                                                                                                                                        | Nothing: the agent ends.                                                                                                                                                   | `{"decision": "block", "reason": ...}` on stdout with exit 0: the agent continues with `reason` (HOST-FACTS `stop-block`).                                                        |
| `hooks stop`                | `Stop`                                                          | `stop-block.json`                                                                                                                                                                                                                                                                                                  | `session_id`, `stop_hook_active`, `background_tasks`                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Nothing: the turn ends.                                                                                                                                                    | `{"decision": "block", "reason": ...}` on stdout with exit 0: the main thread continues with `reason` (HOST-FACTS `stop-block`).                                                  |
| `hooks skill-exists <name>` | `UserPromptSubmit` (declared in a skill's frontmatter `hooks:`) | none in 2.1.281                                                                                                                                                                                                                                                                                                    | none; the name comes from the command line, the payload only proves the event                                                                                                                                                                                                                                                                                                                                                                                                                           | One line of context when the skill is missing, empty when installed.                                                                                                       | Never. Inject mode.                                                                                                                                                               |

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
| `guard/stage-skill`             | `<command> is started by the user, or by /bdk:run for its session; ask the user to type <command> (BDK T41)`                      |
| `guard/gate-manual`             | `<gate> is manual and this run has no --auto; stop the run and ask the user to type <command> (BDK T41, R-9)`                     |

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

### Requirement: Prompt-expansion outcomes

`hooks prompt-expansion` SHALL produce exactly the outcomes below.

The command's stage is the pipeline stage whose `command` is `/<command_name>` (`/bdk:plan` -> `plan`); its gate is the gate node whose `opens` names that stage. The **user-typed marker** is the recorded shape of HOST-FACTS `upe-fields`: `hook_event_name: UserPromptExpansion`, `expansion_type: slash_command`, a non-empty `session_id` and `command_name` in the `bdk:` namespace. A stage command whose payload lacks one of them is blocked with `input/invalid-argument` and writes nothing: an unknown payload shape is "no transition" (fail-closed).

| Situation                                                                                   | Exit | Writes                                                                                                                                                                                                                                                                                                                                                                                                             | stdout / stderr                                                                                             |
| ------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Stage command whose gate is ready (`/bdk:plan` after `design`, `/bdk:close` after `review`) | 0    | `transition` with `source: user`, `gate`, `to` = the stage, the kernel clock, `session` = `session_id`, `command` = `prompt`, and `refs` = the gate node and its requirements that are not skipped                                                                                                                                                                                                                 | stdout: gate status as plain text                                                                           |
| Gate not ready                                                                              | 2    | nothing                                                                                                                                                                                                                                                                                                                                                                                                            | stderr: `policy/gate-not-ready: <gate> is not ready for <command>: <requirement> is <state>, ...`           |
| Gate already done (the user retyped the command, or resumes on another machine, S5)         | 0    | nothing                                                                                                                                                                                                                                                                                                                                                                                                            | stdout: gate status noting the earlier pass                                                                 |
| Stage command without a gate in this profile (`/bdk:execute`, or `tiny` skipping `design`)  | 0    | plain `transition` (`source: kernel`, `to` = the stage, `session`, `command`), with `skip-verify: true` for `/bdk:execute` when `command_args` holds `--skip-verify`; nothing when the latest transition to that stage already has the same `skip-verify`                                                                                                                                                          | stdout: the stage line                                                                                      |
| `/bdk:run [--auto] [<intent>]` with an active Change and no intent                          | 0    | the session's run marker (`kernel-state`, Run marker) with `auto` and `prompt`; one `transition` with `source: policy`, `gate` and `to` = the stage it opens, for each gate that is ready, not done and resolves to `policy.gates.<gate>: auto`, or for every ready gate not done when `--auto` is the first token of `command_args`, with `auto: true` on a gate whose policy is `manual` (T02 decision R-9, T41) | stdout: the gates passed by policy and the manual gates the run stops at, so the user sees them             |
| `/bdk:run [--auto] <intent>` without an active Change                                       | 0    | the session's run marker with `auto` and `prompt`                                                                                                                                                                                                                                                                                                                                                                  | stdout: the run's start line                                                                                |
| `/bdk:run [--auto] <intent>` with an active Change                                          | 2    | nothing                                                                                                                                                                                                                                                                                                                                                                                                            | stderr: `policy/change-exists: ...; type /bdk:run without an intent to continue it, or /bdk:change park`    |
| `/bdk:run` with neither an active Change nor an intent                                      | 2    | nothing                                                                                                                                                                                                                                                                                                                                                                                                            | stderr: `policy/no-active-change: ...; type /bdk:run "<intent>"`                                            |
| No active Change on the branch                                                              | 2    | nothing                                                                                                                                                                                                                                                                                                                                                                                                            | stderr: `policy/no-active-change: ...; run /bdk:change new "<intent>" or bdk change resume <id>`            |
| Payload without the user-typed marker                                                       | 2    | nothing                                                                                                                                                                                                                                                                                                                                                                                                            | stderr: `input/invalid-argument: the UserPromptExpansion payload has no <field>; no transition was written` |

Every typed `/bdk:plan`, `/bdk:execute` or `/bdk:close` removes the run marker of its session before the outcome above: a typed stage command hands the Change back to the user. The intent of `/bdk:run` is `command_args` without a leading `--auto` token, trimmed; the kernel only tests that it is not empty, and the `run` skill passes it to `/bdk:change`. No transition written here carries `input-hash`, so none changes a node's state (`kernel-pipeline`, Node states); only a gate reads them. A non-BDK command (`command_name` without the `bdk:` prefix) or a BDK skill that is neither a stage command nor `run` passes with empty stdout and no write. A nested `claude -p "/bdk:plan"` started from a tool call arrives as a user prompt (HOST-FACTS `upe-headless`); `hooks pre-tool` denies it (`guard/nested-stage-command`). The user's own `!` bash-mode commands do not pass through `PreToolUse` at all (HOST-FACTS `bang-pretool`), a known gap of the spec and command guards.

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

#### Scenario: run with --auto passes a manual gate

- **WHEN** `policy.gates.design` is `manual`, `gate:design` is ready and the user types `/bdk:run --auto`
- **THEN** the kernel writes one `transition` with `source: policy`, `gate: gate:design` and `command: /bdk:run --auto`, and the session's run marker holds `auto: true`

#### Scenario: run from an intent

- **WHEN** the branch has no active Change and the user types `/bdk:run --auto "Add a notification list to the user panel"`
- **THEN** the exit code is 0, no ledger is written, and `.bdk/.machine/runs/<session_id>.json` holds `auto: true` and the typed prompt

#### Scenario: typed stage command ends the run

- **WHEN** session `S1` has a run marker and the user types `/bdk:plan` in `S1`
- **THEN** the marker of `S1` is removed before the gate outcome, whether the gate passes or not

#### Scenario: run leaves a manual gate

- **WHEN** `policy.gates.design` is `manual`, `gate:design` is ready and the user types `/bdk:run`
- **THEN** the kernel writes nothing, exits 0, and stdout names `/bdk:plan` as the command the user types

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

`pre-tool.sh` calls the kernel only when the raw payload contains one of: `.bdk/specs`; `bdk.mjs` and `hooks`; `/bdk:`; `"agent_id"` and either `git` or `bdk.mjs`; `bdk:reader`, `bdk:reviewer`, `bdk:scout` or `bdk:lead`; `"subagent_type"` and either `bdk:worker`, `bdk:runner` or `bdk:lead`; `SendMessage` or `Skill` as `tool_name`. Otherwise it exits 0 without starting Node. `post-tool.sh` calls the kernel only when `.bdk/` exists and `tool_name` is `Agent` or `TaskStop`. The prefilter only over-approximates: whatever it lets through, the kernel decides from the parsed payload.

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

#### Scenario: Skill reaches the kernel

- **WHEN** `pre-tool.sh` receives the recorded `pre-skill.json` payload
- **THEN** it starts the kernel, which decides the call

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
- **Worktree scope** (T45): an `Edit`, `Write` or `NotebookEdit` from a subagent whose package in the registry carries `workdir` (`kernel-state`, Dispatch package) is denied with `guard/worktree-scope` when its `file_path` or `notebook_path`, resolved against the payload's `cwd`, lies outside `workdir`; the reason names the path and `workdir`. A subagent without a package or with a package without `workdir`, and the main thread, are not checked by this guard. A Bash command is not checked: the guard cannot see where a command writes, and the package's `Work root` section carries that rule for the shell (`role-contracts`, Role contract content).
- **Agent message** (T41-D5): a `SendMessage` from a subagent is denied with `guard/agent-message` when `tool_input.message` holds no ledger id (`L-` and eight characters of `[0-9a-z]`) of the active Change, when it is longer than `agents.message.max-chars`, or when `tool_input.to` is not `main` and names an agent that is not `running` or `starting` in the registry. A message from the main thread passes unchecked. The reason names the check that failed and, for a recipient that is not running, `bdk agents list --affected-by <entry>`.

- **Stage skill** (T41, R-9; user decision 2026-10-02): a `Skill` call whose `tool_input.skill` is `bdk:change`, `bdk:plan`, `bdk:execute` or `bdk:close` is denied with `guard/stage-skill` when it comes from a subagent, when the session (`session_id`) has no run marker (`kernel-state`, Run marker), or when it is `bdk:change` and the marker records that the run already started it; otherwise it is admitted. These skills set no `disable-model-invocation`, so this guard, not the host, keeps a model from starting them on its own; the gates stay in the graph, which a `Skill` call cannot pass without a `transition`. An admitted call resolves the Change from the branch and applies the outcome a typed command of the same stage would get (Prompt-expansion outcomes), with three differences: a ready gate not done passes only when it resolves to `auto` or the marker holds `auto: true`, and is written with `source: policy`, the marker's `prompt` as `command` and, when only the marker's `auto` lets it pass, `auto: true` (`kernel-pipeline`, Gate); a ready gate that does not pass is denied with `guard/gate-manual` naming the stage command; `bdk:change` writes nothing and records in the marker that the run started it. A gate that is not ready is denied with `policy/gate-not-ready` as for a typed command. `bdk:design`, `bdk:verify-design`, `bdk:verify-plan` and `bdk:cr` are not guarded.

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

#### Scenario: edit outside the worktree denied

- **WHEN** a `bdk:worker` payload whose registry row names a package with `workdir: /repo/.bdk/.machine/worktrees/<id>/02` carries an `Edit` of `/repo/src/api/http.ts`
- **THEN** it exits 2 with `guard/worktree-scope` naming `/repo/src/api/http.ts` and the `workdir`, and the same `Edit` of `/repo/.bdk/.machine/worktrees/<id>/02/src/api/http.ts` exits 0

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

#### Scenario: run passes an auto gate when it reaches it

- **WHEN** session `S1` has a run marker without `auto`, `policy.gates.design` is `auto`, `gate:design` became ready after `/bdk:run` was typed, and the main thread of `S1` calls `Skill` with `skill: bdk:plan`
- **THEN** it exits 0, the ledger holds one new `transition` with `source: policy`, `gate: gate:design` and `command` equal to the marker's prompt, and `gate:design` is done with `passedBy: policy`

#### Scenario: stage skill from a subagent

- **WHEN** a payload with `agent_id` calls `Skill` with `skill: bdk:plan` in a session with a run marker
- **THEN** it exits 2 with `guard/stage-skill`

#### Scenario: second change in one run

- **WHEN** a run already started `bdk:change` and the main thread calls `Skill` with `skill: bdk:change` again
- **THEN** it exits 2 with `guard/stage-skill`

#### Scenario: design is not guarded

- **WHEN** the main thread calls `Skill` with `skill: bdk:design` in a session without a run marker
- **THEN** it exits 0 and nothing is written

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

On a fixture of 750 recorded-shape `PreToolUse` payloads (main-thread and subagent Bash, edit tools, `Agent` calls, a project path containing `git`): on a payload the prefilter drops, the p95 of the time the guard adds over a bare `sh -c` reading the same payload is under 5 ms; the p95 of a `pre-tool` call that reaches the kernel is under 150 ms; the p95 of `prompt-expansion` on a typed stage command that writes its transition is under 150 ms. With the heartbeat (T41-D6): on a subagent payload the prefilter drops, `pre-tool.sh` and `post-tool.sh` each add a p95 under 5 ms over a bare `sh -c`; the p95 of `hooks subagent-start`, `hooks subagent-stop`, `hooks stop` and `hooks post-tool` is under 150 ms each; `agents wait` returns within 1.5 s of the event that ends it.

#### Scenario: latency budgets

- **WHEN** `pnpm test:perf` runs the guard benchmarks
- **THEN** each p95 is under its budget, and the report names every measured value

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
