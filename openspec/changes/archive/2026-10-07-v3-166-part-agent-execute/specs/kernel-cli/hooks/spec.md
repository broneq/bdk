## MODIFIED Requirements

### Requirement: bdk hooks pre-tool

PreToolUse guard: spec directory, subagent git, subagent kernel commands, `bdk.mjs hooks` from Bash, agent spawns, agent messages, and stage skills a model starts. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks pre-tool`
- **Availability:** `hook`
- **Mode:** `guard`; standalone (`kernel-cli`, Invocation): the guards read only the payload, so a tool call outside a git work tree is decided, not blocked with `runtime/not-a-repo`. The one exception is a `Skill` call to a guarded stage skill inside a run, which reads the session's run marker and resolves the Change from the branch (Pre-tool guards, Stage skill)
- **Arguments:**
  - stdin: PreToolUse payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** Reached only after the shell prefilter (Guard hooks file and prefilter). Reads a Bash command through the command reader (Pre-tool command reading) and applies the guards of Pre-tool guards in this order: `guard/spec-dir-write`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/worktree-scope`, `guard/reader-write`, `guard/draft-only`, `guard/dispatch-prompt`, `guard/agent-spawn`, `guard/escalation-model`, `guard/agent-message`, `guard/stage-skill`, then for a `Skill` call admitted inside a run the stage's gate (`policy/gate-not-ready`, `guard/gate-manual`); the first match denies. An admitted stage skill writes what a typed stage command writes (Prompt-expansion outcomes), with `source: policy` for its gate and the run's typed prompt as `command`. A `SendMessage` that passes and names an agent the registry holds is recorded as a message for that agent (`kernel-state`, Agent registry), which `agents wait` returns. Denied kernel commands: every `orchestrator` and `hook` verb of `kernel-cli`, Availability classes, matched by exact verb. On deny the kernel prints the host's `permissionDecision: deny` JSON with the reason and exits 2 (stderr carries `<rule>: <reason>`). Main-thread git is never touched. The user's own `!` bash-mode commands do not pass through this hook (HOST-FACTS `bang-pretool`), a known gap. A payload that is not JSON, or lacks `tool_name` or `tool_input`, is blocked with `input/invalid-argument`.
- **Writes:** `.bdk/.machine/agents.sqlite`, `.bdk/.machine/runs/`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/hooks-pre-tool.json` for `--json` on pass (the kernel's own decision record, used by tests); the error object on a block under `--json`; the host's stdout shape otherwise (Hook payloads below).
- **Exit codes and rules:** `0` (pass) or `2` (block); guard mode never exits 3, 4 or 5. Rules: `guard/spec-dir-write`, `guard/subagent-git`, `guard/subagent-kernel-command`, `guard/worktree-scope`, `guard/hooks-from-bash`, `guard/nested-stage-command`, `guard/dispatch-prompt`, `guard/reader-write`, `guard/draft-only`, `guard/agent-spawn`, `guard/escalation-model`, `guard/agent-message`, `guard/stage-skill`, `guard/gate-manual`, `policy/gate-not-ready`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object), all reported as exit 2.
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

#### Scenario: guard/draft-only

- **WHEN** a payload with `agent_type: bdk:reader` calls `Write` with a `file_path` outside `.bdk/.machine/drafts/`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/draft-only`

#### Scenario: guard/lead-scope

- **WHEN** a subagent payload runs `bdk.mjs attempt open part 03-1`
- **THEN** the exit code is 2 and the reason on stderr starts with `guard/subagent-kernel-command`; `guard/lead-scope` is no longer emitted (#166)

### Requirement: Pre-tool guards

`hooks pre-tool` SHALL decide each tool call with the guards below; a subagent is a payload with `agent_id` (HOST-FACTS `agent-fg`, `agent-bg`, `main-no-agent-id`).

- **Spec directory** (V1-7, every thread): an `Edit`, `Write` or `NotebookEdit` whose `file_path` or `notebook_path`, relative to the project root, lies under `.bdk/specs/`, or a Bash write whose target lies under `.bdk/specs/`, is denied with `guard/spec-dir-write`. Reading a spec passes.
- **Hooks from Bash** (T1, every thread): a kernel command whose verb is a `hook` class command is denied with `guard/hooks-from-bash`.
- **Nested stage command** (T1, every thread): a simple command with the command word `claude` and a word starting with `/bdk:plan`, `/bdk:execute`, `/bdk:close` or `/bdk:run` is denied with `guard/nested-stage-command`.
- **Subagent git** (T3): a git command whose verb is `stash`, `reset`, `clean`, `restore`, `commit`, `add`, `merge`, `rebase`, `cherry-pick` or `push`; `checkout` with `--`, a `.` argument, `-f` or `--force`; `switch` with `--discard-changes`, `-f` or `--force`. Denied with `guard/subagent-git`. `git checkout <branch>`, `git status`, `git diff` and `git log` pass. Exception (#166, user decision 2026-10-07): a `bdk:worker` payload may run `git add` and `git commit`, since a part agent commits each task and the conformer its fixes with the command `bdk check run` prints (`kernel-cli/check`); still denied with `guard/subagent-git` are `git add` with `-A`, `--all`, `-u`, `--update`, `-f`, `--force` or a pathspec `.`, `./`, `:/` or `*`, which would stage another part's work or an ignored file, and `git commit` with `--amend`, `--no-verify`, `-n`, `-a`, `--all`, a short option cluster holding `a` or `n` (`-am`), `--fixup`, `--squash` or `--allow-empty`. The reason of a denied add or commit names `bdk check run` as the source of the command to run.
- **Subagent kernel command** (T3): a kernel command whose verb is an `orchestrator` class command is denied with `guard/subagent-kernel-command`; `agent` and `read` verbs, `--help` and unknown verbs pass.
- **Read-only adapters** (T23-D14, D20): a Bash write from a payload whose `agent_type` is `bdk:reader`, `bdk:reviewer` or `bdk:scout` is denied with `guard/reader-write`.
- **Report drafts** (#166): these adapters and `bdk:runner` hold the host's `Write` tool for one purpose, the report draft their package names (`kernel-cli/dispatch`); a `Write`, `Edit` or `NotebookEdit` from such a payload whose path, resolved against the payload's `cwd`, lies outside `.bdk/.machine/drafts/` of the project root is denied with `guard/draft-only` naming the path and that directory. The main thread is held the same way while the active Change has an open `review-fix` ticket: `/bdk:cr` writes only the merged report's draft then, and the round's implementer writes the fix; the guard reads the attempt records, and the review round marker (`kernel-state`, Review round marker) only lets the payload past the prefilter. Without an open round the main thread's edits are not checked.
- **Dispatch prompt** (T23-D0): an `Agent` call whose `subagent_type` is `bdk:worker`, `bdk:reader`, `bdk:reviewer`, `bdk:runner` or `bdk:scout` is denied with `guard/dispatch-prompt` unless its prompt holds exactly one path matching `(^|/)\.bdk/changes/[^/\s]+/dispatch/[^/\s]+\.md` and, without that path, at most one sentence: no blank line, at most one sentence end, at most 200 characters. Other `subagent_type` values pass. A `bdk:scout` started by a `bdk:worker` is exempt: it has no package and its prompt is the worker's question (`role-contracts`, Role contract content).
- **Agent spawn** (T41-D4): an `Agent` call from a subagent is denied with `guard/agent-spawn` unless the caller is `bdk:worker`, `subagent_type` is `bdk:scout` and the scouts started by agents holding the caller's ticket number fewer than `agents.scout.max-per-ticket`. Calls from the main thread and from non-BDK agents are not checked by this guard.
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

- **WHEN** the main thread calls `Agent` with `subagent_type: bdk:worker` and the prompt `.bdk/changes/2026-09-25-login/dispatch/02-implementer-A-7f3k9m2q.md Start with the failing test.`
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

- **WHEN** a worker sends a 900-character message naming `L-q7w2e9r4` to the main thread
- **THEN** it exits 2 with `guard/agent-message` naming `agents.message.max-chars`

#### Scenario: admitted message is recorded

- **WHEN** a worker sends `L-q7w2e9r4 changes the token format` to the main thread
- **THEN** it exits 0 and the message is recorded in the registry with the worker's id and `L-q7w2e9r4`

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

#### Scenario: worker commits a task

- **WHEN** a `bdk:worker` payload runs `git add -- src/auth/login.ts && git commit -m "Accept a token" --trailer "BDK-Change: c" --trailer "BDK-Part: 02" --trailer "BDK-Task: 02-3" -- src/auth/login.ts`
- **THEN** it exits 0

#### Scenario: worker add of everything denied

- **WHEN** a `bdk:worker` payload runs `git add -A` or `git add .`
- **THEN** it exits 2 with `guard/subagent-git`

#### Scenario: worker amend denied

- **WHEN** a `bdk:worker` payload runs `git commit --amend --no-edit` or `git commit -am "x"`
- **THEN** it exits 2 with `guard/subagent-git`

#### Scenario: reader commit denied

- **WHEN** a `bdk:reader` payload runs `git commit -m x -- a.ts`
- **THEN** it exits 2 with `guard/subagent-git`

#### Scenario: reader writes its draft

- **WHEN** a `bdk:reader` payload calls `Write` with `file_path` `<PROJECT>/.bdk/.machine/drafts/02-verifier-A-9c2d4f6h.md`
- **THEN** it exits 0

#### Scenario: reader writes outside the drafts

- **WHEN** a `bdk:reviewer` payload calls `Write` with `file_path` `<PROJECT>/src/auth/login.ts`
- **THEN** it exits 2 with `guard/draft-only` naming the path and `.bdk/.machine/drafts/`

#### Scenario: main thread during a review round

- **WHEN** the active Change has the open `review-fix` ticket `A-0review1` and the main thread calls `Write` with `file_path` `<PROJECT>/src/auth/login.ts`
- **THEN** it exits 2 with `guard/draft-only` naming the round, and a `Write` to `<PROJECT>/.bdk/.machine/drafts/A-0review1-merge.md` exits 0

#### Scenario: main thread without a round

- **WHEN** no `review-fix` ticket of the active Change is open and the main thread calls `Write` with `file_path` `<PROJECT>/src/auth/login.ts`
- **THEN** it exits 0 without starting Node

#### Scenario: no lead adapter

- **WHEN** the main thread calls `Agent` with `subagent_type: bdk:lead` and a long prompt
- **THEN** it exits 0, since `bdk:lead` is no BDK adapter, and `bdk export agents --host claude` writes no `lead.md`

#### Scenario: lead dispatches a worker

- **WHEN** a `bdk:worker` payload calls `Agent` with `subagent_type: bdk:worker`
- **THEN** it exits 2 with `guard/agent-spawn`, since only the main thread starts role agents

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

`pre-tool.sh` calls the kernel only when the raw payload contains one of: `.bdk/specs`; `bdk.mjs` or `bdk ` (the word followed by a space), and `hooks`; `/bdk:`; `"agent_id"` and either `git`, `bdk.mjs` or `bdk `; `bdk:reader`, `bdk:reviewer`, `bdk:scout` or `bdk:runner`; `"subagent_type"` and either `bdk:worker` or `bdk:runner`; `SendMessage` or `Skill` as `tool_name`; or, without `"agent_id"`, `Write`, `Edit`, `MultiEdit` or `NotebookEdit` as `tool_name` while `.bdk/.machine/review-round` exists under `CLAUDE_PROJECT_DIR` (#166). Otherwise it exits 0 without starting Node. `post-tool.sh` serves both `PostToolUse` and `PostToolUseFailure`. It calls the kernel only when `.bdk/` exists and either `tool_name` is `Agent`, `TaskStop` or `AskUserQuestion`, or the verbose marker `.bdk/.machine/verbose` exists (`kernel-state`, Verbose log); with the marker, every payload reaches the kernel. The prefilter only over-approximates: whatever it lets through, the kernel decides from the parsed payload. `bdk ` is matched anywhere in the payload, not at the positions a shell command word can take, so no shell construct (`&&`, `;`, `|`, `$(...)`, a subshell) can hide a `bdk <command>` call from the guards. The hook commands themselves run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs"`, never `bdk`, because a plugin's `bin/` is not on a hook's `PATH` (HOST-FACTS `plugin-bin-hook`).

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

#### Scenario: subagent bdk call reaches the kernel

- **WHEN** `pre-tool.sh` receives a subagent Bash payload (`agent_type: bdk:worker`) with the command `bdk commit 01-1`
- **THEN** it starts the kernel, which denies the call with `guard/subagent-kernel-command` exactly as for `node "$P/dist/bdk.mjs" commit 01-1`

#### Scenario: bdk hooks from Bash reaches the kernel

- **WHEN** `pre-tool.sh` receives a main-thread Bash payload with the command `cd app && bdk hooks pre-tool`
- **THEN** it starts the kernel, which denies the call with `guard/hooks-from-bash`

#### Scenario: hook commands do not rely on the launcher

- **WHEN** `hooks/hooks.json` and `hooks/guard/*.sh` are inspected
- **THEN** every kernel call in them runs `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs"`, and none runs `bdk` as a command word

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

- **WHEN** the recorded `PostToolUse` on `Agent` of `lifecycle-bg.json` with `status: async_launched` arrives from the main thread with a prompt naming a dispatch package
- **THEN** the child's row exists with `main` as `parent`, the package's ticket, and state `starting`

#### Scenario: foreground result ends the child

- **WHEN** the recorded `PostToolUse` on `Agent` of `lifecycle.json` with `status: completed` arrives
- **THEN** the child is `ended` with `ended-by: agent-result`

### Requirement: Continuation check

`hooks stop` and `hooks subagent-stop` SHALL block the end of a turn exactly when the agent's own scope still holds work it can do now, and SHALL let it end otherwise (T41-D7, HOST-FACTS `stop-block`).

The check answers `block` only when the thread has open work:

| Thread                 | Open work                                                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| main thread            | The latest `transition` whose `session` is this `session_id` opened a stage, and `bdk next` returns a `ready` or `stale` artifact of that stage, not waiting on a gate or on the user (`kernel-cli/graph`, bdk next). |
| any other `bdk:` agent | It has an active package and the package's `report` path does not exist.                                                                                                                                              |

and, for every thread, all of these hold: no entry of `background_tasks` has `status: running` other than the agent itself (HOST-FACTS `subagent-stop`), since a finished background child wakes its parent; no `question` entry of the Change is open and the Change is not parked; and `continuations` is below `agents.continuation.max`. Non-BDK subagents and payloads outside a BDK project always pass.

A block answers `{"decision": "block", "reason": "<reason>"}` on stdout with exit 0 and increments `continuations`. The reason names the open work and the next command, for example `BDK: execute-part:02 is ready (bdk next). Continue it; end your turn only to ask the user a question or to report a blocker.` or `BDK: your report for A-9k2m4n6p is not stored. Write it to its draft and run bdk log ingest --ticket A-9k2m4n6p --file <draft>, then return your envelope.`. Progress resets `continuations` to 0: a new ledger entry, a stored report or a closed ticket in the agent's scope since the previous block. When `continuations` reaches `agents.continuation.max`, the check passes and writes one `finding` with `source: kernel`, `review: true` and the refs of the open work, stating that the agent stopped with work open. A block never ends the agent; a pass of `hooks subagent-stop` ends it with `ended-by: subagent-stop`.

#### Scenario: T40 early stop is sent back

- **WHEN** during `/bdk:execute` the main thread ends its turn after part 01 with `execute-part:02` ready, no background task and no open question
- **THEN** `hooks stop` answers `block` with a reason naming `execute-part:02`, and `continuations` is 1

#### Scenario: question to the user ends the turn

- **WHEN** the same happens while a `question` entry is open
- **THEN** `hooks stop` passes

#### Scenario: background part agents keep main waiting

- **WHEN** the main thread ends its turn while the implementers of two parts run in the background
- **THEN** `hooks stop` passes, and the host's task notification wakes it later (HOST-FACTS `lead-detach`)

#### Scenario: worker without a report

- **WHEN** a `bdk:worker` ends its turn and its package's `report` path does not exist
- **THEN** `hooks subagent-stop` answers `block` naming `bdk log ingest --ticket <ticket> --file`

#### Scenario: limit without progress

- **WHEN** `agents.continuation.max` is 3 and a worker ends its turn a fourth time with no new entry, report or closed ticket since the first block
- **THEN** the hook passes, one `finding` with `review: true` names the worker's ticket, and the worker is `ended`

#### Scenario: ordinary conversation

- **WHEN** the main thread ends a turn in a session with no stage transition
- **THEN** `hooks stop` passes

#### Scenario: background leads keep main waiting

- **WHEN** the main thread ends its turn while the implementers of two parts run in the background
- **THEN** `hooks stop` passes, and the host's task notification wakes it later (HOST-FACTS `lead-detach`)

#### Scenario: lead with a task left

- **WHEN** a `bdk:worker` holding the implementer package of part `02` ends its turn while task `02-3` is not committed, its report not stored and nothing runs in the background
- **THEN** `hooks subagent-stop` answers `block` naming `bdk log ingest --ticket <ticket> --file`

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
    "reason": "BDK: your report for A-9k2m4n6p is not stored. Write it to its draft and run bdk log ingest --ticket A-9k2m4n6p --file <draft>, then return your envelope.",
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
