---
status: accepted
date: 2026-09-25
decision-makers: {TBD}
consulted: {TBD}
informed: {TBD}
---

# ADR-0001: Remove the bundled MCP servers (serena and code-review-graph) from v3

## Context and Problem Statement

BDK v2 ships two MCP servers in its plugin `.mcp.json`, serena and code-review-graph, both started through unpinned `uvx`, and builds its tool tiers, agent `tools:` lists and three hooks on them. v2.6.0 showed the cost: a `Stop` hook ran a graph update after every reply in every session (30-60% CPU for minutes under 8 parallel sessions), and both servers hit the 30 s connect timeout at session start. v3 task T03 (issue #68) measured whether either server earns that cost, so v3 decides per server: default-on, opt-in, or removed.

## Decision Drivers

- **Value, measured, not assumed.** A server stays only if it improves correctness, or cuts cost or wall time by at least 20% at equal correctness, beyond run-to-run noise (T03 design rule D-7, generalised from T02 decision R-16).
- **Machine load under parallel work.** The user runs 5-10 Claude Code sessions in parallel, in separate worktrees, plus subagents. A token saving does not offset a slower machine or longer wall time.
- **Robustness at session start.** Cold starts, connect timeouts and failure modes must not leave agents instructed to use tools that do not exist.
- **Simplicity of the v3 kernel.** Every server brings `uv` / `uvx`, a pin, hooks, tier fragments and per-agent tool lists that have to be kept consistent.

## Considered Options

1. **Remove both servers** - no bundled MCP; tiers, hooks and agent tools use only built-in tools.
2. **Keep code-review-graph opt-in, remove serena** - graph off by default behind a `features` flag, on the strength of the dead-code task.
3. **Keep both opt-in** - both off by default, each behind its own flag.
4. **Keep both default-on (v2 status quo)** - as shipped in v2, with pins and without the `Stop` hook.

## Decision Outcome

**Chosen option: 1, remove both servers**, because neither server passes the value rule on the benchmark: code-review-graph was measurably better on 0 of 8 tasks, serena on 0 of 8, and serena on top of the graph was better on 1 and worse on 1. At the same time, both add start-up time, several hundred MB of RSS per session, and cold-start timeouts. Under D-7 a server that fails value is removed whatever the load test would show, so the parallel-load test (P3) was not run.

### Consequences

- ✅ No `uv` / `uvx` runtime dependency for MCP; nothing to pin, and no `uv.lock` kept for MCP.
- ✅ Session start loses 0.9-1.4 s per server warm and up to 45 s cold. No MCP connect timeouts, no second process tree per session, no 178-182 MB graph database per worktree.
- ✅ Tool tiers collapse to one text that works on every host, so the tier-vs-`tools:` drift disappears and availability detection is not needed.
- ✅ The `Stop` graph update and the `register-graph-repo` SessionStart hook go away. The latter cost about 0.4 s per session start even warm.
- ❌ The one task where the graph looked consistently useful, dead-code detection (V7), loses that help. On V7 the graph's three runs were all 0.588 against a C0 median of 0.435, but inside C0's range, so it is not a measured win.
- ❌ Users who relied on `semantic_search_nodes` / `get_symbols_overview` in their own workflow must install the servers themselves at user level.
- 🟡 The result holds for one TypeScript monorepo with Haiku 4.5 as the worker. On another stack a server may perform differently; the harness (in git history, see Evidence) reruns on another repository.
- 🟡 The repository's own `CLAUDE.md` graph section is a dev-time choice for BDK contributors, not part of the plugin, and is not decided here.

### Implementation Requirements

- [ ] T13 `ctx` and content hooks: no `uvx` lines in `hooks.json`; `hooks session-start` drops graph repo registration; `ctx skill` tier chains carry only the built-in-tools tier, and the acceptance test "`features.code-review-graph` gives the graph tier" becomes "tier text is the same with or without the flag"; `features.code-review-graph` and `features.serena` become unknown keys that `config check` reports as removed.
- [ ] T11 `doctor`: no `uv` / `uvx` check.
- [ ] T04 remove the bundled MCP servers from the shipping v2 plugin: `.mcp.json` servers, the `uvx` hook lines (including the `Stop` graph update), `hooks/register-graph-repo/`, `.serena/`, the graph and serena tool tiers, MCP tools in agent `tools:` and skill `allowed-tools`, the `features.code-review-graph` / `features.serena` keys, and the tests and docs that name them.
- [ ] T32 import and cleanup: drop `uv.lock` (not needed for MCP); the v2 -> v3 import reports the dropped `features` keys.
- [ ] T41 stage skills: tool-tier guidance is the built-in-tools text; the CI content test "`mcp__plugin_bdk_` in tool names" becomes "no `mcp__plugin_bdk_` names".
- [ ] T42 roles and adapters: adapter `tools:` without MCP tools; the `scout` adapter keeps the four former agents merged, with `Read`, `Grep`, `Glob`, `Bash` (T02 decision R-7).
- [ ] Retire `.claude/rules/mcp-tool-naming.md` and the MCP parts of `.claude/rules/fragment-system.md` (T04).
- [ ] `docs/V3-IMPLEMENTATION-PLAN.md`: T03 Resolution paragraph pointing to this ADR; T11, T13, T32, T41 and T42 name the outcome where it changes them.

## Pros and Cons of the Options

### Remove both servers

The plugin ships no MCP server. Search, tracing and review use `Bash` (`grep`, `rg`, `find`, `git`) and `Read` in the main session, plus `Grep` / `Glob` in subagents.

- ✅ Matches the measurement: no configuration beat C0 on any task under D-7, and with Sonnet 5 as the model no run called an MCP tool at all.
- ✅ Removes every measured cost: start-up time, memory per session, cold-start timeouts, graph update CPU, hooks.
- ✅ One tier text, no drift between tier menus and agent `tools:`, no need to know at session start whether a server connected.
- ❌ Loses the graph's apparent, but not significant, help on dead-code detection.

### Keep code-review-graph opt-in, remove serena

- ✅ Keeps a possible dead-code advantage for users who want it.
- ❌ Against the agreed rule: the graph fails value, and D-7 allows opt-in only for a server that passes value but fails the load gate.
- ❌ Keeps the `uvx` path, a pin, a tier variant, an update strategy and the tier-vs-`tools:` consistency test, all for 1 of 8 task types.
- ❌ Cold graph starts took 31-45 s and would all fail under the default 30 s `MCP_TIMEOUT`.
- ❌ Would need the parallel-load test (P3, about an hour of load on the user's machine) before it could be justified.

### Keep both opt-in

- ✅ Maximum choice for users.
- ❌ All the costs of the previous option, twice. serena was the weakest configuration on dead code (98-202 tool calls per run, lowest scores).

### Keep both default-on (v2 status quo)

- ✅ No migration for v2 users.
- ❌ Pays every cost in every session for no measured value.
- ❌ In default sessions the tools are often not there yet (servers are `pending` at `init`), so the tier text points at missing tools.

## More Information

### Benchmark

`BloopAI/vibe-kanban` at `f4b0fd9`, TypeScript part only (no Rust toolchain on the host): 1193 files, 9166 graph nodes. BDK under test: `cdea721`, v2.6.0 without the `Stop` graph hook. Host: Claude Code 2.1.282 on macOS, with a load average of 9-19 from other work during the measurements. Servers: code-review-graph 2.3.9, and serena at git HEAD `7a29683`.

There are four configurations, each loading its own plugin copy with exactly its servers and matching `.bdk/settings.json` features: C0 (no MCP), CG (graph), CS (serena) and CGS (both). The work used 96 Haiku 4.5 value runs (8 tasks × 4 configurations × 3), 16 Sonnet 5 confirmation runs, 78 connect starts, 9 graph operations and 4 failure-mode runs, for about USD 13.4 in total.

The tasks were: V1 symbol lookup, V2 call sites with same-name decoys, V3 type importers, V4 blast radius of a signature change, V5 change review, V6 architecture overview, V7 dead code, and V8 structural rename. Reference answers were committed before the first measured run.

### Value (Haiku 4.5, median of 3 runs; D-7 verdict against the comparison)

| Task | C0 score / USD / s  | CG score / USD / s  | CS score / USD / s  | CGS score / USD / s | Measurable difference                 |
| ---- | ------------------- | ------------------- | ------------------- | ------------------- | ------------------------------------- |
| V1   | 1.00 / 0.018 / 18   | 1.00 / 0.024 / 20   | 1.00 / 0.026 / 35   | 1.00 / 0.017 / 22   | CS slower than C0                     |
| V2   | 1.00 / 0.064 / 38   | 1.00 / 0.041 / 33   | 1.00 / 0.057 / 63   | 1.00 / 0.067 / 70   | none                                  |
| V3   | 0.60 / 0.051 / 33   | 0.60 / 0.031 / 33   | 0.60 / 0.048 / 48   | 0.60 / 0.090 / 196  | CGS slower than CG                    |
| V4   | 1.00 / 0.141 / 59   | 0.95 / 0.102 / 50   | 1.00 / 0.193 / 85   | 1.00 / 0.148 / 71   | CGS better than CG (one package item) |
| V5   | 1.00 / 0.014 / 15   | 1.00 / 0.013 / 17   | 1.00 / 0.033 / 15   | 1.00 / 0.013 / 16   | none (ceiling)                        |
| V6   | 0.857 / 0.066 / 33  | 0.857 / 0.087 / 41  | 0.857 / 0.073 / 29  | 0.857 / 0.106 / 56  | CGS dearer and slower than C0         |
| V7   | 0.435 / 0.363 / 336 | 0.588 / 0.194 / 111 | 0.286 / 0.303 / 274 | 0.500 / 0.224 / 146 | none (C0 range 0-0.545, 156-543 s)    |
| V8   | 1.00 / 0.164 / 57   | 1.00 / 0.113 / 54   | 1.00 / 0.148 / 80   | 1.00 / 0.109 / 52   | CGS cheaper than C0                   |

The rule: a gap counts only if the gap between medians exceeds the larger within-configuration range, and cost or time count only at equal correctness with a gap of at least 20%. Summed per server comparison:

- graph vs C0: 0 tasks better.
- serena vs C0: 0 better, 1 worse.
- serena on top of the graph vs graph alone: 1 better, 1 worse.

In the Sonnet 5 slice (V2, V4, V5, V8 × 4 configurations × 1), every run scored 1.0 and no run made an MCP call.

### Cost

| Measurement                                     | code-review-graph                                                                                                                        | serena                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Connect, warm, one session (C0 baseline 0.45 s) | +0.9 s (median 1.3 s)                                                                                                                    | +1.3-1.4 s (median 1.7-1.9 s)                                                  |
| Connect, cold uv cache                          | 31-45 s; 6 of 6 over the 30 s default                                                                                                    | 19-34 s; 2 of 9 over (both PyPI-pinned)                                        |
| Connect, 4 sessions starting together           | median 7.4-7.8 s, max 20.1 s (both servers alike)                                                                                        | same                                                                           |
| RSS per session                                 | 136-700 MB server, plus 178-182 MB database per worktree on disk                                                                         | 165-220 MB server, plus about 285 MB TypeScript language server                |
| Other                                           | `register-graph-repo` hook about 0.4 s per session start; full build 12 s wall, 20 CPU s; incremental update 1-2 s wall, under 1.5 CPU s | unpinned spec queries the GitHub API on every start and does not start offline |

A single graph update is cheap. The v2.6.0 load came from running an update after every reply in every session, not from one update.

### Failure mode and availability

With a server forced past the connect timeout and default MCP settings, the server is `pending` at `init` and its tools never appear. The model fell back to `grep` + `Read` on its own and answered correctly in 4 of 4 runs; the wasted work was at most one `ToolSearch`.

Nothing a hook or skill can read at session start knows whether a server connected:

- The `SessionStart` input has no MCP field.
- `claude mcp list` inside a hook starts every server again, and once hung session start for more than 5 minutes.
- The `init` event says `pending` in the default nonblocking start.
- T01's recorded Init payload has only `mcp_tool_count`.

A measurement finding for anyone who configures servers: `MCP_TIMEOUT` (default 30000) is the per-server connect timeout, while `MCP_CONNECT_TIMEOUT_MS` (default 5000) is only how long start-up waits for pending servers.

### Tier-vs-`tools:` drift in v2 (removed by this decision)

Six agents are told by their preloaded tiers to use MCP tools they are not granted:

- `architecture-reviewer`, `design-verifier`, `explorer` and `plan-verifier` lack graph tools such as `get_community_tool`, `get_knowledge_gaps_tool` and `find_large_functions_tool`.
- `implementer` and `fixer` lack serena's `rename_symbol` and `safe_delete_symbol`.

### R-7: `scout` stays one adapter

The orchestrator did the search tasks V1-V4 itself (one `bdk:explorer` spawn in 48 runs). V7 spawned `bdk:dead-code-detector` in 9 of 12 runs. The only tool one former agent needed that the others lack was the graph's `refactor_tool`, which goes with the graph. Without MCP, all four former agents need the same read-only set.

### Evidence

Harness and raw data were committed under `docs/v3/t03-mcp-eval/` and removed from the tree after this ADR was accepted. They stay in git history: `git show e061216:docs/v3/t03-mcp-eval/<path>` (or `git checkout e061216 -- docs/v3/t03-mcp-eval`). Paths below are relative to that directory:

- harness and flags: `README.md`
- raw runs: `runs/`
- per-run table: `results/value-runs.md`
- connect times: `results/p1-connect.md`
- graph operations: `results/p2-graph-ops.md`
- failure mode: `results/failure-mode.md`
- availability sources: `results/availability.md`
- pin specs: `results/pins.md`
- drift list: `results/tier-tools-drift.md`

The OpenSpec change is `v3-t03-mcp-value-evaluation`. Related decisions are T02 R-7 and R-16, in `docs/V3-SKILL-INVENTORY.md`.
