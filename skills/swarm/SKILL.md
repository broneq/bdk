---
name: swarm
description: Principles for running BDK role agents in waves - isolation, concurrency, the ledger as channel, post-task steps under the ticket, single resume. Use when a BDK stage skill dispatches role agents; not user-facing.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
user-invocable: false
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill swarm 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: swarm" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill swarm` first and apply its output; on a `BDK STOP` line, stop and report it.

# Swarm

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

How the orchestrator runs the role agents of one dispatch round. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. How the host starts, runs and resumes agents: [Claude Code](references/hosts/claude-code.md), the only host in 3.0.

## Waves

- **Isolation.** Dispatch in one wave only tasks whose `Files:` are disjoint (P6). A task that shares a file with a task of the wave waits for the next wave.
- **Concurrency.** Run at most `execution.concurrency` agents at once; the `Concurrency` section of the BDK context above states the number. Further packages wait for a free slot.
- **Prompt.** Give each agent its package path from `bdk dispatch build` and at most one further sentence. Everything the agent needs is in the package or in what the package names.

## One ticket

1. `bdk attempt open` gives the ticket and its `steps`, the post-task steps in pipeline order with their roles.
2. Build the implementer's package, dispatch it and wait until it returns with its report stored.
3. For each entry of `steps`, in order and under the same ticket: build the package for the step's role, dispatch it and wait until it returns with its report stored. Build a ticket's next package only after the agent of its active package has returned and any resume is over.
4. Close the ticket with `bdk attempt close <ticket> ok|fail`. The kernel decides whether the step evidence suffices; on a refusal, dispatch again the step it names, then close again. Act on `next.action`.

## Ledger as the channel

- Agents talk through the ledger, not through you. Before the next wave, read what each finished ticket logged with `bdk log list --since-ticket-start <ticket>`; an open `blocker` on a task of the next wave holds that task back.
- A `SendMessage` to `main` about a critical finding stops the wave: start no new agent, let running agents finish, read the entry it names and decide before the next dispatch.

## Single resume

An agent that returns without a stored report at its package's `report` path, or whose report `bdk log ingest` refused, is resumed once with the missing report or the refusal named. When it fails a second time, close the ticket `fail` with the reason.

## Agent tree

The swarm is flat: you dispatch every agent yourself. Use a nested tree of agents only when the host note allows it; in 3.0 no adapter carries the Agent tool.
