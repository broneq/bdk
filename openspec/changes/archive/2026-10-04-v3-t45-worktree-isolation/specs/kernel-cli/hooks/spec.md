## MODIFIED Requirements

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
