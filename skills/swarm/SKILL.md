---
name: swarm
description: Principles for running BDK role agents in waves - isolation, concurrency, one agent per part, waiting, files as the channel, steps under the ticket, single resume. Use when a BDK stage skill dispatches role agents; not user-facing.
allowed-tools: Bash(bdk *) Bash(echo *)
user-invocable: false
---

!`bdk ctx skill swarm 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: swarm" heading appears above, run `bdk ctx skill swarm` first and apply its output; on a `BDK STOP` line, stop and report it.

# Swarm

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

How `main` runs the role agents of its work: deliver every ticket closed through `bdk attempt close`, with as many agents busy as the limits allow. How the host starts, runs and resumes agents: [Claude Code](references/hosts/claude-code.md), the only host in 3.0.

## Waves

- **Isolation.** Dispatch together only parts whose `Files:` are disjoint (P6): the `wave` of `bdk next` lists them, and an overlapping part waits for a later wave. The kernel enforces it: `attempt open` refuses `policy/files-busy` while another open ticket holds a file of the target.
- **One agent per part.** `main` opens one `part` ticket per part of the wave and starts one `implementer` per part, never one agent per task. The implementer works through the part's tasks and commits each; the checks run in `bdk check run`, not in an agent. Nothing goes deeper than role agent and, under a worker, the `Agent(scout)` that is its only spawn.
- **Concurrency.** `main` runs at most `execution.concurrency` children at once; the `Concurrency` section of the BDK context above states the number.
- **Prompt.** Give each agent its package path from `bdk dispatch build` and at most one further sentence.

## Waiting

Start every agent in the background. `main` ends its turn after a dispatch and is woken by the host's task notification.

## Files carry the substance

Everything an agent must know is in its package, the ledger or a report; a message names a ledger id and adds one sentence. Before the next wave, read what each finished ticket logged with `bdk log list --since-ticket-start <ticket>`; an open `blocker` on a task of the next wave holds that task back. A `SendMessage` to `main` about a critical finding stops the wave: start no new agent, let the running ones finish, and decide on the entry it names before the next dispatch.

## Steps under the ticket

`bdk attempt open` gives the ticket and its `steps`. After the implementer returns with its report stored, dispatch the `conformer`, the agent step of the ticket's `steps`, under the same ticket, its package built only after the implementer has returned, then run `bdk attempt close <ticket> ok|fail`. The kernel decides whether the commits and the step evidence suffice; act on its `next.action`.

## Escalation

On `next.action: escalate`, open the escalation ticket with `bdk attempt open <loop> <target> --escalate` and run it like any other, starting each of its agents on the `model` that its `bdk dispatch build` returns. The stronger model is the escalation; `hooks pre-tool` denies a start without it. On `parked`, stop that target and report.

## Single resume

Resume an agent once, naming the cause, when it returns without a stored report, its report got a `bdk log ingest` refusal, or it turns `suspect`. After a second failure, close the ticket `fail` with the reason.
