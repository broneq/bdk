---
name: execute-thin
description: Executes the plan parts of the active BDK Change through role agents, one ticket per task, until the kernel points past the execute stage. Use when the user types /bdk:execute.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Agent SendMessage Read
disallowed-tools: Edit Write NotebookEdit
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" next 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

# Execute

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

You are the orchestrator. The kernel knows the order of the work; you ask it, do what it says through role agents, and report back to it. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

You never edit project files yourself and never run tests or linters yourself: role agents do the work, the kernel records it.

## The loop

1. `bdk next --json`. When its `artifact` belongs to a stage after `execute`, or `artifact` is null, go to "Finish".
2. Do what its `instruction` says, with the commands the kernel prints and the rules below. A plan part starts with `bdk part start <part>`; its output lists the tasks.
3. When the instruction's "When finished" command succeeds, go back to 1.

## One task

Every task of a started part runs as one ticket, opened with `bdk attempt open task-redispatch <task> --json`. Load the `bdk:swarm` skill once before the first ticket and follow its "One ticket" and "Waves" sections: they give the order of the packages inside a ticket. Close a ticket `ok` when every agent returned `done` and the runner's evidence passed, otherwise `fail`.

## Dispatch

- One Agent tool call per package: `subagent_type` is `bdk:` plus the package's `adapter` field from `dispatch build`, and the prompt is the package `path` and nothing else.
- Every call of a wave goes in one message, at most as many as the swarm skill's concurrency allows.

## Envelope

A role agent returns an envelope: `status`, `files`, `entries`, `evidence`, and `reason` for `blocked` or `needs-context`, plus its report path.

| `status`             | What you do                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `done`               | Continue with the next step of the ticket.                                                                                              |
| `done-with-concerns` | Read the entries it names (`bdk log show <id>`); continue unless one is a `blocker`, then close the ticket `fail`.                      |
| `needs-context`      | Resume the same agent once with `SendMessage`, naming what it asked for from the package or the ledger; if it asks again, close `fail`. |
| `blocked`            | Close the ticket `fail` with the reason in the report.                                                                                  |

An agent that returns without its report stored is resumed once with `SendMessage` naming the missing report; a second miss closes the ticket `fail`.

## Next action

`attempt close` answers with `next.action`:

| `next.action` | What you do                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| `commit`      | `bdk commit <task> --json`.                                                     |
| `retry`       | Open a new ticket for the same task and dispatch again.                         |
| `narrow`      | Open a new ticket; the kernel gives the narrower scope in the package.          |
| `escalate`    | `bdk attempt open task-redispatch <task> --escalate --json` and dispatch again. |
| `parked`      | Stop the loop and go to "Finish": the Change waits for the user.                |

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP` or another exit code: stop and report the output.

## Finish

Run `bdk change status --json` and report to the user in a few lines: parts done, tasks committed, open findings or blockers, and the command the gate status names as the user's next step. If the Change is parked, name the question and the resume command.
