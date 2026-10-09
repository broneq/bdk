---
name: execute
description: 'Runs the execute stage of an OpenSpec Change - starts one bdk:lead agent that builds the verified plan parts in parallel waves (implement-part, conform-part, commits, worktree merges, state.json), waits for its result, and passes the result or a blocker on. Use when a Change has a verified plan and should be built, when asked to "execute", "build" or "implement" a Change or its plan, or when /bdk:run reaches the execute stage.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git rev-parse *) Read Glob Grep Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Execute

You start the execute lead and pass its result on; the lead does the stage. You never implement, conform, commit, merge or resolve anything yourself, never edit a file, and never start an implementer or conformer: a part, a plan or a merge that needs fixing goes back to the user or to its own stage.

## 1. Check the configuration and the Change

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: start nothing and reply with that line.

- **Change**: the argument. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- **Plan**: `openspec/changes/<change>/plan/parts/` must hold at least one part file; otherwise stop and name `/bdk:plan <change>` as the stage to run first.
- **Queue**: when `.bdk/runs/run.json` exists and queues the Change, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" run status --json` and read the Change's entry. Stage `execute`: go on. Any earlier stage: stop, naming the stage, its reason and its command (`/bdk:<stage> <change>`). A later stage: reply that the parts are built and name that stage's command.
- **Run directory**: `.bdk/runs/<change>` under the path `git rev-parse --show-toplevel` prints, as an absolute path.

Done when you hold the Change and the absolute run directory, or stopped.

## 2. Start the lead

Tell the user in one line what runs, e.g. `Building the plan: bdk:lead writes .bdk/runs/add-csv-export/execute/result.md`.

Start one agent with the Agent tool:

- `subagent_type: "bdk:lead"`;
- prompt `Run the skill bdk:execute-waves with the arguments: <change> --run-dir <absolute run directory>`;
- `run_in_background: true` when `execution.lead` is `background` (the default); in the foreground when it is `foreground`;
- `model` set to `models.lead.model` and `effort` set to `models.lead.effort`, each only when the configuration sets it.

Keep the agent ID it returns. A background lead reports through a notification that arrives by itself: end your turn and wait for it, without polling its files or sleeping, and do nothing else on this Change meanwhile.

Done when the lead has returned.

## 3. Read the result

Read `<run directory>/execute/result.md`. When it is missing, reply that the lead ended without a result, give its last message, and stop; `/bdk:execute <change>` resumes from `state.json`.

- `Status: done`: reply with the status line, the result path, and the next stage, `/bdk:auto-review <change>`. Stop.
- `Status: blocked`: go to step 4.

Done when you know the status.

## 4. Pass a blocker on

Name each line of the result's `## Blockers` section: the part, the kind, the evidence in one line, and its command (`/bdk:plan <change>` for a plan defect).

- `policy.questions: decide-and-record`: do not retry; no policy clears a plan defect or a missing tool. Reply with the blockers and the line `Decision: stopped without a retry (policy.questions: decide-and-record)`, and stop.
- `policy.questions: stop` (the default): ask the user whether to retry the blocked parts now (after they fixed the cause) or stop here. Use `AskUserQuestion` (load it with `ToolSearch` when it is deferred); when it is not available, put the question at the end of your reply and stop.
  - Retry: continue the same lead with `SendMessage` to its agent ID: `Run the skill bdk:execute-waves again with the same arguments; the user fixed the cause of the blockers and asks for a retry.` Wait for it, then go back to step 3.
  - Stop: reply with the blockers and their commands, and that `/bdk:execute <change>` continues from `state.json`.

Never claim the stage is done while a part is blocked. Done when the user's choice is carried out, or you stopped.
