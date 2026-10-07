---
name: execute
description: Executes the verified plan of the active BDK Change through role agents - every ready part as one ticket, an implementer and a conformer per part, until the Change leaves the execute stage. Use when a Change waits on /bdk:execute.
allowed-tools: Bash(bdk *) Bash(echo *) Agent SendMessage Skill Read AskUserQuestion
disallowed-tools: Edit Write NotebookEdit
---

!`bdk ctx skill execute 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: execute" heading appears above, run `bdk ctx skill execute` first and apply its output; on a `BDK STOP` line, stop and report it.

# Execute

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md).

You are `main`, the orchestrator of the Change's execute stage. The kernel knows the order of the work and records it; role agents do the work. Add `--json` to every command whose output you act on. You never edit a project file and never run tests or linters yourself.

Load the `bdk:swarm` skill with the Skill tool before the first dispatch and follow it: isolation, concurrency, one agent per part, waiting, files as the channel, steps under the ticket, escalation, single resume. The `Concurrency` section of the BDK context above states how many agents run at once.

Done when `bdk next` leaves the execute stage or the Change is parked, and you have given the report of "Finish". One `/bdk:execute` runs every ready part: when a part is done, run `bdk next` and go on with the parts it returns. A pending `review: true` entry or the review gate's status is no reason to stop while an execute-stage node is ready. End your turn earlier only while your agents run (the host wakes you with their notifications), to ask the user a decision the plan and the design do not hold, or to report a refusal you cannot resolve. A turn that ends with "next I will ..." while a part is ready is not done.

## The loop

Run `bdk next --json` and act on what it returns:

| `next` returns                                                         | What you do                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| an `execute-part` artifact with `wave`                                 | run every part of `wave` that is not running yet (see "Parts")                                   |
| `spec-delta`                                                           | `bdk done spec-delta`; the plan stage wrote and checked the deltas                               |
| a step node (`conform`, `tests-scoped`, `lint`) of a part already done | the part's evidence is missing or stale: run a `verify-fix` ticket (see "Steps of a done part")  |
| a node of a later stage, or `waiting: gate` or `waiting: nothing`      | go to "Finish"                                                                                   |
| `waiting: user` (the Change is parked)                                 | go to "Finish" and name the park question and the resume command                                 |
| a node of an earlier stage (the plan is not done or not verified)      | dispatch nothing: report what `next` returns and the stage command it names, such as `/bdk:plan` |

## Parts

Each part of `wave` carries `started`, its open `tickets`, its `isolation` and, for a worktree part, its `workdir`. Run `bdk part start <part> --json` for each part that is not started: its output lists the part's tasks with their `Files:`, `Depends on:` and success measure.

One part is one ticket and two agents. For each part of the wave:

1. Open its ticket with `bdk attempt open part <part> --json`. A part already started with an open ticket goes on from that ticket's next step.
2. Build the implementer's package with `bdk dispatch build <part> implementer <ticket> --json` and start one `Agent` in the background with `subagent_type: bdk:worker` and the package `path` as the whole prompt. The implementer works through the part's tasks and commits each with the command `bdk check run` prints; you start no agent per task and commit nothing.
3. When it returns with its report stored, build the conformer's package with `bdk dispatch build <part> conformer <ticket> --json` and start one more `bdk:worker` the same way. The conformer checks the part's commits against the rules and the project's instructions and runs the part's checks.
4. When the conformer returns, run `bdk attempt close <ticket> ok|fail --json` with the outcome the envelopes give, and act on its `next.action`. On `policy/tasks-uncommitted`, resume the implementer once naming the tasks the refusal lists; when they are still not committed, close the ticket `fail`.

The next ticket of a part after a `fail` marks the tasks already committed in its package, so its implementer goes on with the rest.

**Worktree parts.** A part with `isolation: worktree` runs in its own worktree, which `bdk part start` makes; its wave item then carries `workdir`. Start the `shared` parts of the wave first, then the worktree parts, so the setup of a worktree does not hold back the rest. Dispatch a worktree part as any other: its packages carry the work root, so pass only the package path, and never set the host's own `isolation: worktree` on an `Agent` call, which branches from the default branch instead of the Change. The kernel runs git in the worktree and merges it back at `bdk part done`.

Start every agent in the background and end your turn after a dispatch round; each finished agent wakes you. On an escalation ticket, pass each agent the `model` that its `bdk dispatch build` returned.

## Envelopes

Every role agent returns an envelope with `status`, `files`, `entries`, `evidence` and its report path, plus `reason` for `blocked` or `needs-context`.

| `status`             | What you do                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `done`               | Continue with the next step of the ticket, or close it.                                                         |
| `done-with-concerns` | Read the entries it names with `bdk log show <id>`; continue unless one is a live `blocker`, then close `fail`. |
| `needs-context`      | Resume the same agent once with `SendMessage`, naming what it asked for from the package or the ledger.         |
| `blocked`            | Close the ticket `fail` with the reason.                                                                        |

An agent that returns without its report stored, with a report `bdk log ingest` refused, or that turns `suspect`, is resumed once with the cause named; after a second failure, close the ticket `fail`.

A `SendMessage` to you about a critical entry stops new dispatches: let the running agents finish, read the entry, and decide on it before the next start. Ask the user, as the `Asking the user` section of the BDK context says, only when the entry needs a decision the plan, the design and the ledger do not hold, and record the answer with `bdk log add decision`.

## Next actions

`bdk attempt close` answers with `next.action`:

| `next.action` | What you do                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `part-done`   | `bdk part done <part> --json`, then `bdk next --json`.                                                                    |
| `retry`       | Open the next ticket of the same loop and target, and dispatch again.                                                     |
| `narrow`      | Open the next ticket; its package carries the narrower scope.                                                             |
| `escalate`    | Open the next ticket with `bdk attempt open <loop> <target> --escalate --json`; start its agents on the returned `model`. |
| `parked`      | Start no further agent for that target; when nothing else runs, go to "Finish".                                           |

## Steps of a done part

A step node of a part that is already done means a later part changed one of its files, or its evidence is missing or failed. Open `bdk attempt open verify-fix <part> --json` and run it as a part ticket without the implementer: build the conformer's package and start it, then close the ticket. When the close fails, open the next `verify-fix` ticket and dispatch the implementer with `bdk dispatch build <part> implementer <ticket> --json` before the conformer. Act on `next.action`.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- `policy/files-busy` from `attempt open` means another open ticket holds a file of the target: start it after that ticket closes. The kernel also keeps parts whose `Files:` overlap out of one `wave`.
- Parts share one working tree, so uncommitted files may be another part's work. Never run git commands that discard or hide work (stash, reset, clean, checkout or restore of paths); report the refusal to the user instead.
- `policy/merge-conflict` from `part done`: open the merge ticket its `instead` names, `bdk attempt open verify-fix <part> --json`, dispatch the implementer and then the conformer as for a part ticket, close it, and on `next.action: part-done` run `bdk part done <part> --json` again. A `parked` answer goes to the user like any other.
- `policy/merge-blocked` from `part done`: the home checkout has uncommitted changes the merge would overwrite; run `part done` again after the next commit of the home checkout.
- `runtime/worktree-setup-failed` from `part start` and `policy/worktree-dirty` from `part done`: start nothing more for that part, keep running the other parts of the wave, and name the refusal and its `instead` in your report. Run no git command in a worktree, edit nothing there yourself, and leave `execution.worktree.enabled` to the user.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- A `BDK STOP` line or another exit code: stop and report the output.

## Finish

Report to the user in a few lines, from kernel output only:

- the parts with their state, from `bdk part list --json`;
- the tasks committed in this run, the wall time and the agents started per part;
- the open `blocker` and `finding` entries of the Change (`bdk log list --type blocker --json`, `bdk log list --type finding --json`);
- the pending `review: true` entries, from `bdk change status --json`;
- the next command: `/bdk:cr` when the review stage is next, or the question and the `bdk change resume` command of a parked Change.
