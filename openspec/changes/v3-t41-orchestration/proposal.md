# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T41. Tracks #61.

T41 rewrites the stage skills for current models, not as a port of the v2 skills. The skills that dispatch work (`execute` first, `cr` in T42) need an orchestration layer that the host alone does not provide. That layer is a tree of agents that coordinate locally, exchange short signals and keep the substance in files. The host facts recorded for this Change (docs/HOST-FACTS.md, rows marked 2.1.284) show three gaps:

- A subagent lead cannot wait for its children. With background children it finishes at once (`lead-detach`), and with foreground children it receives no message until all of them return (`lead-fg`).
- No payload names a spawned agent's parent at start (`subagent-start`), and `SubagentStop` is missing when an agent is cut off by `maxTurns` or killed (`stop-on-maxturns`, `stop-on-taskstop`).
- Agents have no names or sibling roster (`agent-params`), so peers cannot address each other without BDK.

The Opus 5.5 prompting guide adds a fourth gap: models end turns early with progress reports. The T40 execute measurement saw exactly that (docs/V3-EVAL-EXECUTE-AB.md, "For T41").

This Change is the first of the T41 Changes. It builds the orchestration layer the stage skills stand on. The stage skills themselves follow in later Changes.

## What Changes

- **Agent registry.** The kernel records every subagent of a session: `SubagentStart` (with its own ID handed to the agent through `additionalContext`), the parent link from `PostToolUse` on `Agent`, a heartbeat from every tool call written by the shell prefilter without starting Node, and end signals (`SubagentStop`, `PostToolUse` on `TaskStop`, the parent's foreground `Agent` result, a stale session). An agent silent for longer than a TTL becomes `suspect`, not `ended`. The registry is a machine-local database, `.bdk/.machine/agents.sqlite`.
- **`bdk agents wait`.** A blocking kernel command a lead calls through `Bash` between dispatches. It returns when a message is queued for the caller, a child stored its report or ended, a child became `suspect`, or a timeout passed. The model spends no tokens while it blocks. Subagents are still started with the host's `Agent` tool; there is no worker pool.
- **Tree topology.** A new `lead` role and adapter coordinates one plan part: its tickets, the waves inside the part, the post-task steps and `attempt close`. Leads start their children in the background. The lead holds a `part-lead` ticket and may run `attempt open|close`, `dispatch build` and `commit` inside its own part; `commit` serialises across leads. A worker may start a `scout` (layer 3) within a policy limit. **BREAKING** for `role-contracts` as T23 left it: this supersedes T23-D50 (a flat swarm in 3.0) and the "no `Agent` tool yet" clause of T23-D20, and extends T23-D15 (the ledger stays the channel; messages become pointers into it). T23-D6 already allowed "a tree of agents when warranted".
- **Messaging.** The content of every signal between agents lives in the ledger; a message carries a ledger id and one sentence. Upward messages go to the agent's lead, critical ones to `main` as today, lateral ones to the agents that `bdk agents list --affected-by <entry>` returns. A `PreToolUse` guard on `SendMessage` admits a message only to a `running` agent, only with a ledger reference and only up to a length limit.
- **Continuation hooks.** `Stop` (for `main`, only while a stage skill runs) and `SubagentStop` (for leads and workers) block the end of a turn while the kernel reports ready work for that agent's scope, and let it end on a user question, a manual gate, running background work or after three continuations in a row without progress.
- **Time signal.** A lead reads its elapsed time in every `bdk agents wait` answer and continuation reason, with no budget, plus one sentence in its contract that time matters.
- **`main` waits natively.** The `execute` orchestrator starts leads in the background and relies on the host's task notifications; the `Stop` hook keeps it from ending a turn early.
- **Effort per adapter.** Adapters pin `effort`: `low` for `runner` and `scout`, `medium` for the others.
- **Prompt convention.** A new dev-time rule in `.claude/rules/` for `skills/**` and `agents/**` on writing skill and contract prose for Opus 5.5.
- **Plan update.** The T41 section of `docs/V3-IMPLEMENTATION-PLAN.md` gains this orchestration layer and a separate `verify-design` stage skill that runs on a fresh context (user decision 2026-09-30).

## Capabilities

### New Capabilities

- `kernel-cli/agents`: the `agents` command group: `bdk agents list` (with `--affected-by` and `--children-of`), `bdk agents show` and `bdk agents wait`.

### Modified Capabilities

- `kernel-cli`: the availability class of the new verbs and the lead exception; the new rules in the catalogue.
- `kernel-cli/hooks`: new entry points for `SubagentStart`, `SubagentStop`, `Stop` and `PostToolUse`; the `SendMessage` and scout guards and the lead verbs in `hooks pre-tool`; the heartbeat in the shell prefilter; registration in `hooks/hooks.json`; latency budgets.
- `kernel-cli/dispatch`: the `lead` role and its package.
- `kernel-cli/commit`: serialised commits.
- `kernel-loops`: the `part-lead` loop and its `part-done` rung.
- `kernel-state`: the `part-lead` loop in the attempt record; the agent registry.
- `kernel-settings`: the `policy.budgets.part-lead` key and the `agents` keys.
- `kernel-architecture`: the `agents` slice and its edges.
- `role-contracts`: the `lead` role and adapter, `Agent` in the `lead` and `worker` adapters, `effort` per adapter, messages in the role contracts, the rewritten swarm skill.

The tree-or-flat rule (T41-D3) lands with `v3-t41-execute`, which redesigns the wave `bdk next` hands `/bdk:execute`.

## Impact

- Kernel: a new `agents` slice, new `hooks` entry points, registry tables in the machine store, settings keys; `dist/bdk.mjs` rebuilt.
- Plugin: `hooks/hooks.json`, `hooks/guard/pre-tool.sh` (heartbeat and `SendMessage` in the prefilter), a new `agents/lead.md` and changed adapters through `bdk export agents --host claude`, a new `skills/roles/lead/SKILL.md`, a rewritten `skills/swarm/SKILL.md`.
- Docs: `docs/V3-IMPLEMENTATION-PLAN.md` (T41 section), `docs/HOST-FACTS.md` (already updated), the user guide pages on agents and hooks (`docs/guide/`).
- Tests: E2E and contract tests for the new commands and hooks, driven by the 2.1.284 payload fixtures; the host probe stays the source of the facts.
- Out of scope: the stage skills `execute`, `plan`, `verify-plan`, `design`, `verify-design`, `setup`, `change`, `close` and `run` (later T41 Changes); `cr` and `pr-review` on the swarm (T42).
