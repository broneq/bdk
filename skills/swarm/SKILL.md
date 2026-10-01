---
name: swarm
description: Principles for running BDK role agents in waves and trees - isolation, concurrency, leads per part, waiting, files as the channel, steps under the ticket, single resume. Use when a BDK stage skill or a lead dispatches role agents; not user-facing.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
user-invocable: false
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill swarm 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: swarm" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill swarm` first and apply its output; on a `BDK STOP` line, stop and report it.

# Swarm

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

How an orchestrating agent, `main` or a lead, runs the role agents of its work: deliver every ticket closed through `bdk attempt close`, with as many agents busy as the limits allow. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. How the host starts, runs and resumes agents: [Claude Code](references/hosts/claude-code.md), the only host in 3.0.

## Waves and the tree

- **Isolation.** Dispatch together only tasks whose `Files:` are disjoint (P6); a task that shares a file with a running one waits for the next wave.
- **Tree.** When the kernel marks a wave as a tree, `main` starts one lead per part of the wave with the part's `lead` package, and each lead runs its part's tasks; otherwise `main` runs the tasks itself. The tree is at most lead, role agent and, under a worker, a scout.
- **Concurrency.** Each orchestrating agent runs at most `execution.concurrency` children at once; the `Concurrency` section of the BDK context above states the number.
- **Prompt.** Give each agent its package path from `bdk dispatch build` and at most one further sentence.

## Waiting

Start every agent in the background. A lead waits with `bdk agents wait <own id>` between dispatches and acts on each event it returns, never by ending its turn. `main` ends its turn after a dispatch and is woken by the host's task notification.

## Files carry the substance

Everything an agent must know is in its package, the ledger or a report; a message names a ledger id and adds one sentence. Before the next wave, read what each finished ticket logged with `bdk log list --since-ticket-start <ticket>`; an open `blocker` on a task of the next wave holds that task back. A `SendMessage` to `main` about a critical finding stops the wave: start no new agent, let the running ones finish, and decide on the entry it names before the next dispatch.

## Steps under the ticket

`bdk attempt open` gives the ticket and its `steps`. After the implementer returns with its report stored, dispatch the ticket's `steps` in order under the same ticket, each package built only after the previous agent has returned, then run `bdk attempt close <ticket> ok|fail`. The kernel decides whether the step evidence suffices; act on its `next.action`.

## Escalation

On `next.action: escalate`, open the escalation ticket with `bdk attempt open <loop> <target> --escalate` and run it like any other, starting each of its agents on the `model` that its `bdk dispatch build` returns. The stronger model is the escalation; `hooks pre-tool` denies a start without it. On `parked`, stop that target and report.

## Single resume

Resume an agent once, naming the cause, when it returns without a stored report, its report got a `bdk log ingest` refusal, or it turns `suspect`. After a second failure, close the ticket `fail` with the reason.
