---
name: execute-long
description: Coordinates the plan parts of the active BDK Change part by part, one ticket per part, an implementer that commits each task, then a conformer. Use when the user types /bdk:execute.
disable-model-invocation: true
allowed-tools: Bash(bdk *) Bash(echo *) Bash(git status *) Bash(git log *) Agent SendMessage Read
disallowed-tools: Edit Write NotebookEdit
---

# Execute (Coordinator)

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

This skill is a **coordinator only**. It walks the plan parts of the active Change, opens a ticket per part and dispatches two role agents with the packages the kernel builds: the implementer commits each task, the conformer checks the part. It never edits files, never runs tests or linters, never reads source code. Role agents do all work; the kernel keeps all state.

Add `--json` to every command whose output you act on.

**Where state lives.** Nothing is held in your head that the kernel does not also hold: parts and their state (`bdk part list`), tickets and budgets (`bdk attempt list`), the ledger (`bdk log list`), evidence (`bdk evidence check`), and task commits with their `BDK-Task` trailers in git. After a crash, `bdk next` and `bdk part list` tell you where you are.

**Core loop:**

```
next -> part start -> per part:
  attempt open part -> implementer (commits each task) -> conformer (check run <part>)
  -> attempt close -> part-done | narrow | retry | escalate | parked
-> part done -> next part -> review gate status
```

---

## Role agents

| Role          | Adapter (`subagent_type`) | Does                                                                                                     | Changes files |
| ------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------- |
| `implementer` | `bdk:worker`              | Builds the part's tasks test-first, runs `bdk check run <task>` and commits each task as it prints       | yes           |
| `conformer`   | `bdk:worker`              | Checks the part's commits against the rules and instructions, runs `bdk check run <part>`, commits fixes | yes           |

The adapter to use is always the `adapter` field that `bdk dispatch build` returns; the table is what you should expect. Dispatch rules:

- One Agent tool call per package. `subagent_type` is `bdk:<adapter>`. The prompt is the package `path` from `dispatch build` and nothing else; the package carries the part, the ledger entries, the role contract and the report path.
- The pre-tool guard refuses a dispatch whose prompt carries more than the package path. Never work around it.
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

`bdk next --json` lists the ready parts in `wave`. Parts of one wave have disjoint `Files:` and run in parallel, at most 5 agents at once. Announce each wave:

```
[execute] Wave: parts {ids}
```

For every part of the wave run Step 3. Dispatch the implementers of a wave in one message; each ticket then continues on its own.

---

## Step 3 - One part, one ticket

### 3a. Open the ticket

`bdk attempt open part <nn> --json` returns `ticket`, `attempt`, `of`, `scope` and `steps` (the post-task steps in pipeline order: `conform` by the `conformer`, `tests-scoped` and `lint` through `bdk check run`).

- `policy/budget-exhausted` or `policy/oscillation`: the ladder is over for this part; if `instead` names `--escalate`, go to 3g, otherwise go to Step 5 (the Change is parked).
- `policy/ticket-open`: a ticket of this part is still open from an earlier run; continue it from its next step.

### 3b. Implementer

1. `bdk dispatch build <nn> implementer <ticket> --json`.
2. Dispatch it: Agent tool, `subagent_type: bdk:<adapter>`, prompt = the package `path`. The package marks the tasks already committed.
3. Handle the envelope (3e).

### 3c. Conformer

1. `bdk dispatch build <nn> conformer <ticket> --json`, only after the implementer has returned.
2. Dispatch and handle the envelope. The conformer stores its report, runs the part's checks and commits its fixes; `attempt close` records the `conform` evidence from the report.

### 3d. Close the ticket

Decide the outcome from what the agents returned, not from your own reading of the code:

| Situation                                                              | Close                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Implementer `done`, conformer `done`                                   | `bdk attempt close <ticket> ok --json`                       |
| A check recorded `fail`, or an agent returned `blocked`                | `bdk attempt close <ticket> fail --json`                     |
| A check could not run (`not-run` evidence: missing tool, broken setup) | `bdk attempt close <ticket> not-run --reason "<why>" --json` |

On `policy/tasks-uncommitted`, resume the implementer once naming the tasks; when they are still not committed, close `fail`. On `policy/missing-evidence` or `policy/stale-evidence`, dispatch the conformer again, then close again. On `policy/do-not-touch`, close `fail`; the next attempt's package names the finding.

### 3e. Envelopes

Every role agent returns an envelope (`status`, `files`, `entries`, `evidence`, `reason`) and its report path.

| `status`                                  | Action                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `done`                                    | Next step of the ticket.                                                                                                                                |
| `done-with-concerns`                      | `bdk log show <id>` for each entry it names. A `blocker` or a correctness concern: close the ticket `fail`. An observation: log nothing more, continue. |
| `needs-context`                           | `SendMessage` to the agent once with what it asked for, taken from the package or the ledger. A second `needs-context`: close `fail`.                   |
| `blocked`                                 | Close the ticket `fail`; its `reason` goes into the next attempt through the ledger.                                                                    |
| no report stored, or `log ingest` refused | Resume the agent once with `SendMessage`, naming the missing report or the refusal. A second miss: close `fail`.                                        |

An agent's `SendMessage` to `main` about a critical finding stops the wave: start no new agent, let running agents finish, read the entry it names, then continue or close the affected tickets `fail`.

### 3f. Act on `next.action`

| `next.action` | Action                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `part-done`   | Step 4.                                                                                            |
| `retry`       | Same scope: back to 3a for the same part.                                                          |
| `narrow`      | Back to 3a; the new ticket has the narrower `scope` and its package drops the findings outside it. |
| `escalate`    | 3g.                                                                                                |
| `parked`      | The ladder ended with a question for the user. Stop dispatching and go to Step 5.                  |

### 3g. Escalation

`bdk attempt open part <nn> --escalate --json` opens the escalation ticket with `escalation.model`. Dispatch both agents with that model on the Agent call. A `fail` close of the escalation ticket returns `parked`.

---

## Step 4 - Close the part

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
- Commit nothing yourself: the role agents commit with the command `bdk check run` prints.
- Report what the kernel recorded, not what you expect: a task is done when its commit exists.
