---
name: execute-long
description: Coordinates the plan parts of the active BDK Change part by part, one ticket per task, implementer then post-task steps, a commit per task. Use when the user types /bdk:execute.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Bash(git status *) Bash(git log *) Agent SendMessage Read
disallowed-tools: Edit Write NotebookEdit
---

# Execute (Coordinator)

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

This skill is a **coordinator only**. It walks the plan parts of the active Change, opens a ticket per task, dispatches role agents with the packages the kernel builds, and commits each task through the kernel. It never edits files, never runs tests or linters, never reads source code. Role agents do all work; the kernel keeps all state.

Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

**Where state lives.** Nothing is held in your head that the kernel does not also hold: parts and their state (`bdk part list`), tickets and budgets (`bdk attempt list`), the ledger (`bdk log list`), evidence (`bdk evidence check`), and task commits with their `BDK-Task` trailers in git. After a crash, `bdk next` and `bdk part list` tell you where you are.

**Core loop:**

```
next -> part start -> waves of tasks -> per task:
  attempt open -> implementer -> simplifier -> runner (tests-scoped, lint)
  -> attempt close -> commit | narrow | retry | escalate | parked
-> part done -> next part -> review gate status
```

---

## Role agents

| Role          | Adapter (`subagent_type`) | Does                                                                       | Changes files |
| ------------- | ------------------------- | -------------------------------------------------------------------------- | ------------- |
| `implementer` | `bdk:worker`              | Builds one task test-first within its `Files:`                             | yes           |
| `simplifier`  | `bdk:worker`              | Simplifies the ticket's uncommitted diff, stores its report                | yes           |
| `runner`      | `bdk:runner`              | Runs the package's `Checks` and records `tests-scoped` and `lint` evidence | no            |

The adapter to use is always the `adapter` field that `bdk dispatch build` returns; the table is what you should expect. Dispatch rules:

- One Agent tool call per package. `subagent_type` is `bdk:<adapter>`. The prompt is the package `path` from `dispatch build` and nothing else; the package carries the task, the ledger entries, the role contract and the report path.
- The pre-tool guard refuses a dispatch whose prompt carries more than the package path, and refuses a subagent's `git` write commands. Never work around either.
- Wait for each agent; do not poll. Background agents notify you when they finish.

---

## Step 0 - Prepare

1. `bdk change status --json`. No active Change: stop and tell the user to open one with `/bdk:change`. A parked Change: report its question and resume command and stop.
2. `git status --porcelain`. Paths outside `.bdk/` that are modified before you start belong to the user: stop and list them. Never commit, stash or discard them.
3. `bdk next --json`. Its `artifact` must be an `execute-part:<nn>`; if it belongs to an earlier stage, report the command the user must type and stop; if it belongs to a later stage, go to Step 5.
4. `bdk part list --json`. Print the plan:

   ```
   [execute] Change {change}
     Parts: {nn} {title} ({tasks} tasks, {state}) ...
     Next: execute-part:{nn}
   ```

---

## Step 1 - Start the part

1. `bdk part start <nn> --json`. It validates the part and lists its tasks with their `Files:` and the part's `do-not-touch`.
2. A refusal (exit 2) names the failing check (`policy/part-too-large`, `policy/do-not-touch-overlap`, `policy/validation-failed`, ...). You cannot fix a plan here: report the rule and its `why` to the user and stop.

## Step 2 - Waves

Group the part's tasks into waves:

- Tasks whose `Files:` are disjoint may run in one wave.
- A task that shares a file with an earlier task of the part waits for the wave after it; keep the plan's order otherwise.
- At most 5 agents run at once; further packages wait for a free slot.

Announce each wave:

```
[execute] Part {nn} wave {w}: tasks {ids}
```

For every task of the wave run Step 3. Dispatch the implementers of a wave in one message; each ticket then continues on its own.

---

## Step 3 - One task, one ticket

### 3a. Open the ticket

`bdk attempt open task-redispatch <task> --json` returns `ticket`, `attempt`, `of`, `scope` and `steps` (the post-task steps in pipeline order: `simplify` by the `simplifier`, `tests-scoped` and `lint` by the `runner`).

- `policy/budget-exhausted` or `policy/oscillation`: the ladder is over for this task; if `instead` names `--escalate`, go to 3h, otherwise go to Step 5 (the Change is parked).
- `policy/ticket-open`: a ticket of this task is still open from an earlier run; close it first with the outcome its evidence shows (`fail` when unsure).

### 3b. Implementer

1. `bdk dispatch build <task> implementer <ticket> --json`.
2. Dispatch it: Agent tool, `subagent_type: bdk:<adapter>`, prompt = the package `path`.
3. Handle the envelope (3f).

### 3c. Simplifier

1. `bdk dispatch build <task> simplifier <ticket> --json`.
2. Dispatch and handle the envelope. The simplifier stores its report; `attempt close` records the `simplify` evidence from it.

### 3d. Runner

1. `bdk dispatch build <task> runner <ticket> --json`. The package's `Checks` name the scoped test command and the lint and typecheck commands from the project settings.
2. Dispatch and handle the envelope. The runner records `tests-scoped` and `lint` evidence with a verdict and a citation, and logs a `finding` for every failure.
3. Run the steps in the order `attempt open` listed them. Build a step's package only after the previous agent of the ticket has returned.

### 3e. Close the ticket

Decide the outcome from what the agents returned, not from your own reading of the code:

| Situation                                                                     | Close                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Implementer `done`, simplifier `done`, runner evidence `pass` for both checks | `bdk attempt close <ticket> ok --json`                       |
| A check recorded `fail`, or an agent returned `blocked`                       | `bdk attempt close <ticket> fail --json`                     |
| A check could not run (`not-run` evidence: missing tool, broken setup)        | `bdk attempt close <ticket> not-run --reason "<why>" --json` |

On `policy/missing-evidence` or `policy/stale-evidence`, the kernel names the step whose evidence is missing or stale: dispatch that step's package again (3c or 3d), then close again. On `policy/do-not-touch`, the diff touches a forbidden path: close `fail`; the next attempt's package names the finding.

### 3f. Envelopes

Every role agent returns an envelope (`status`, `files`, `entries`, `evidence`, `reason`) and its report path.

| `status`                                  | Action                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `done`                                    | Next step of the ticket.                                                                                                                                |
| `done-with-concerns`                      | `bdk log show <id>` for each entry it names. A `blocker` or a correctness concern: close the ticket `fail`. An observation: log nothing more, continue. |
| `needs-context`                           | `SendMessage` to the agent once with what it asked for, taken from the package or the ledger. A second `needs-context`: close `fail`.                   |
| `blocked`                                 | Close the ticket `fail`; its `reason` goes into the next attempt through the ledger.                                                                    |
| no report stored, or `log ingest` refused | Resume the agent once with `SendMessage`, naming the missing report or the refusal. A second miss: close `fail`.                                        |

An agent's `SendMessage` to `main` about a critical finding stops the wave: start no new agent, let running agents finish, read the entry it names, then continue or close the affected tickets `fail`.

### 3g. Act on `next.action`

| `next.action` | Action                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `commit`      | `bdk commit <task> --json`. The commit carries the `BDK-Change`, `BDK-Part` and `BDK-Task` trailers. Print `[execute] {task} committed {sha}`. |
| `retry`       | Same scope: back to 3a for the same task.                                                                                                      |
| `narrow`      | Back to 3a; the new ticket has the narrower `scope` and its package drops the findings outside it.                                             |
| `escalate`    | 3h.                                                                                                                                            |
| `parked`      | The ladder ended with a question for the user. Stop dispatching and go to Step 5.                                                              |

`bdk commit` refusals: `policy/nothing-to-commit` means the task changed nothing - check the implementer's envelope and close the next ticket `fail` if work is missing; `policy/git-hook-failed` - report the hook output and stop.

### 3h. Escalation

`bdk attempt open task-redispatch <task> --escalate --json` opens the escalation ticket with `escalation.model`. Dispatch the implementer package with that model on the Agent call, then continue with 3c. A `fail` close of the escalation ticket returns `parked`.

---

## Step 4 - Close the part

When every task of the part is committed:

1. `bdk part done <nn> --json`. It refuses while a ticket is open or a task has no trailer commit; the refusal names which.
2. `bdk next --json`. Another `execute-part:<nn>`: back to Step 1. An artifact of a later stage: Step 5.

---

## Step 5 - Finish

1. `bdk change status --json` and `bdk log list --review --json`.
2. Print the summary:

   ```
   [execute] Change {change}: {parts done}/{parts} parts, {tasks committed}/{tasks} tasks
     Commits: {short shas}
     Open findings: {n} (review: {ids})
     Parked: {question and resume command, if parked}
     Next: {the command the gate status names for the user}
   ```

3. Never pass a gate yourself; the review gate waits for the user.

---

## Kernel refusals

- **Exit 2** is a refusal: the error object carries `rule`, `why` and `instead`. Do what `instead` names; never repeat the refused command unchanged.
- **Exit 3** is an input error: a wrong argument or flag. Read `bdk <command> --help` and fix the call.
- **Exit 4 or 5**, or a `BDK STOP` line: state or runtime problem. Stop and report the output; `bdk doctor` names the repair.

## Rules

- Coordinator only: no Edit, no Write, no test or lint commands of your own.
- One ticket per attempt; never reuse a closed ticket.
- The prompt of a dispatch is the package path only.
- Commit only through `bdk commit <task>`; never `git commit` yourself.
- Report what the kernel recorded, not what you expect: a task is done when its commit exists.
