# V3 MCP evaluation: serena and code-review-graph (T03)

Task T03 of `docs/V3-IMPLEMENTATION-PLAN.md`, issue #68, OpenSpec change `v3-t03-mcp-value-evaluation`. Harness, raw runs and per-measurement files live in `docs/v3/t03-mcp-eval/` (paths below are relative to it unless they start with `docs/`).

## Summary

- **Value.** On 8 tasks over the tool tiers, 3 Haiku 4.5 runs per task and configuration, neither server is measurably better than no MCP under the agreed rule (design D-7): code-review-graph 0 of 8 tasks, serena 0 of 8, serena on top of the graph 1 of 8 (a 0.05 correctness gap on V4) against 1 of 8 slower. On the Sonnet 5 slice the orchestrator made **zero** MCP calls in every configuration: with a strong model the servers are only overhead.
- **Cost.** Warm, one session: +0.9 s (graph) and +1.3-1.4 s (serena) to session start. Cold uv cache: 31-45 s (graph) and 19-34 s (serena), so under the default 30 s `MCP_TIMEOUT` all 6 cold graph starts and 2 of 9 cold serena starts would fail. With 4 sessions starting together, median connect rose to 7.4-7.8 s (max 20 s). Per session and worktree: graph server 136-700 MB RSS and a 178-182 MB database; serena 165-220 MB plus about 285 MB for the TypeScript language server.
- **Failure mode.** A server that misses the timeout costs at most one wasted call; the model falls back to `grep` + `Read` on its own and answered correctly in 4 of 4 runs. The tier cannot follow availability: nothing a hook or skill can read at session start knows whether a server connected.
- **Recommended disposition: both servers removed** from the bundled `.mcp.json`, the tier chains reduced to the fallback, and the `Stop` / `register-graph-repo` hooks gone. The P3 parallel-load test was not run: under D-7 a server that fails value is removed whatever the gate shows (open decision 2).

## Baseline

| Item | Value |
|---|---|
| Benchmark | `BloopAI/vibe-kanban` at `f4b0fd9`, TypeScript part only (no Rust toolchain on the host; user decision). Snapshot as an orphan commit with the identical tree, no history. |
| BDK under test | `cdea721` (v2.6.0 without the graph `Stop` hook); the `Stop` variant uses `69e1f51:hooks/hooks.json`. |
| Host | Claude Code 2.1.282, macOS (Darwin 27), load average 9-19 from other sessions and endpoint security during the measurements. |
| Servers | code-review-graph 2.3.9 (`uvx code-review-graph serve`); serena git HEAD `7a29683` (`uvx --from git+https://github.com/oraios/serena ...`). |
| Graph size | 1193 files, 9166 nodes, 77644 edges (`results/p2-graph-ops.md`). |
| Configurations | C0 no MCP; CG graph; CS serena; CGS both. Each run loads its own plugin copy whose `.mcp.json` has exactly its servers, with matching `.bdk/settings.json` features (`README.md`). |
| Invocation | `claude -p` with `--plugin-dir`, `--setting-sources project,local`, `--no-session-persistence`, `--allowedTools` for the MCP tools, `ENABLE_CLAUDEAI_MCP_SERVERS=false`, blocking connect (`MCP_CONNECTION_NONBLOCKING=0`, `MCP_CONNECT_TIMEOUT_MS=120000`); each flag's reason and the isolation check are in `README.md`. |
| Models | Haiku 4.5 (`claude-haiku-4-5-20251001`) for all 96 value runs; Sonnet 5 (`claude-sonnet-5`) for 16 confirmation runs. |
| Spend | about USD 13.4 in total, including judge calls (`python3 evaluate.py spent runs`). |

## Cost

### Connect (P1)

| label | spec | mode | n | median s | min-max s | over C0 median s | over 30 s default | failures | raw times s |
|---|---|---|---|---|---|---|---|---|---|
| C0 | no MCP server (baseline) | warm | 10 | 0.45 | 0.43-1.01 | +0.00 | 0/10 | 0 | 1.01, 0.65, 0.44, 0.43, 0.44, 0.45, 0.45, 0.43, 0.46, 0.43 |
| P1-G | `uvx code-review-graph serve` | warm | 10 | 1.31 | 1.24-5.29 | +0.87 | 0/10 | 0 | 5.29, 1.77, 1.50, 1.24, 1.27, 1.36, 1.28, 1.28, 1.30, 1.33 |
| P1-Gpin | `uvx code-review-graph==2.3.9 serve` | warm | 10 | 1.29 | 1.23-2.72 | +0.85 | 0/10 | 0 | 1.34, 1.30, 1.32, 1.29, 1.27, 1.23, 1.23, 1.29, 1.46, 2.72 |
| P1-S | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` | warm | 10 | 1.85 | 1.76-5.30 | +1.41 | 0/10 | 0 | 5.30, 1.91, 2.12, 1.82, 1.80, 1.76, 1.88, 1.83, 1.82, 1.91 |
| P1-Ssha | `uvx --from git+https://github.com/oraios/serena@7a29683... serena ...` | warm | 10 | 1.71 | 1.55-4.13 | +1.26 | 0/10 | 0 | 4.13, 1.55, 1.59, 1.83, 1.76, 3.08, 2.84, 1.65, 1.63, 1.66 |
| P1-Spypi | `uvx --from serena-agent==1.7.0 serena ...` | warm | 10 | 1.83 | 1.76-6.72 | +1.38 | 0/10 | 0 | 6.72, 1.84, 1.81, 1.79, 1.76, 1.80, 2.90, 4.11, 2.33, 1.80 |
| C0 | no MCP server (baseline) | cold | 3 | 0.43 | 0.39-0.48 | +0.00 | 0/3 | 0 | 0.48, 0.39, 0.43 |
| P1-G | `uvx code-review-graph serve` | cold | 3 | 41.05 | 37.50-45.28 | +40.62 | 3/3 | 0 | 45.28, 41.05, 37.50 |
| P1-Gpin | `uvx code-review-graph==2.3.9 serve` | cold | 3 | 37.15 | 31.24-41.14 | +36.72 | 3/3 | 0 | 41.14, 37.15, 31.24 |
| P1-S | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` | cold | 3 | 22.09 | 20.89-25.76 | +21.66 | 0/3 | 0 | 25.76, 20.89, 22.09 |
| P1-Ssha | `uvx --from git+https://github.com/oraios/serena@7a29683... serena ...` | cold | 3 | 24.28 | 18.68-25.63 | +23.85 | 0/3 | 0 | 18.68, 24.28, 25.63 |
| P1-Spypi | `uvx --from serena-agent==1.7.0 serena ...` | cold | 3 | 33.14 | 26.92-34.08 | +32.71 | 2/3 | 0 | 26.92, 34.08, 33.14 |

Warm is 10 starts, cold 3 starts with an empty `UV_CACHE_DIR` and `UV_TOOL_DIR`; raw per start in `results/p1/warm.jsonl` and `results/p1/cold.jsonl`, method and notes in `results/p1-connect.md`. With the graph on, time to `init` includes BDK's `register-graph-repo` SessionStart hook (`uvx code-review-graph register` + `status`, synchronous): C0 measured in a graph-on worktree took 0.87 s warm and 19-23 s cold instead of 0.45 s / 0.43 s.

Connect under parallel starts, from the value runs' MCP logs (4 sessions at once, warm): 1.4-20.1 s per server, median 7.4-7.8 s, for both servers alike; three Sonnet attempts hit `CONNECT_TIMEOUT` while an unrelated `uvx` build held the uv cache lock (`README.md`, Isolation check; `runs/_invalid/sonnet/V5/`).

### Graph operations (P2)

| operation | wall s | CPU s (user + sys) | peak RSS MB | graph.db MB after | graph output |
|---|---|---|---|---|---|
| `build` | 12.25 | 20.51 | 176.8 | 181.6 | Full build: 1193 files, 9166 nodes, 77644 edges (postprocess=full) |
| `update-nochange` | 1.27 | 0.48 | 54.5 | 181.6 | Incremental: 0 files updated, 0 nodes, 0 edges (postprocess=full) |
| `update-1file` | 1.15 | 0.97 | 71.9 | 181.6 | Incremental: 1 files updated, 8 nodes, 42 edges (postprocess=full) |
| `update-20files` | 1.61 | 1.35 | 72.9 | 181.9 | Incremental: 20 files updated, 91 nodes, 743 edges (postprocess=full) |
| `build-skip-flows` | 9.19 | 17.81 | 96.0 | 177.6 | Full build: 1193 files, 9166 nodes, 77644 edges (postprocess=minimal) |
| `update-nochange-skip-flows` | 1.99 | 0.69 | 54.8 | 177.6 | Incremental: 0 files updated, 0 nodes, 0 edges (postprocess=minimal) |
| `update-1file-skip-flows` | 1.11 | 0.78 | 68.2 | 177.7 | Incremental: 1 files updated, 8 nodes, 42 edges (postprocess=minimal) |
| `update-20files-skip-flows` | 1.47 | 1.16 | 68.0 | 180.1 | Incremental: 20 files updated, 91 nodes, 743 edges (postprocess=minimal) |
| `postprocess` | 1.61 | 1.46 | 170.2 | 180.8 | Post-processing: 984 flows, 27 communities, 9077 FTS entries |

One incremental update is cheap (1-2 s, under 1.5 CPU s); the v2.6.0 field report (30-60% CPU for minutes under 8 sessions) comes from running it after every reply in every session, not from a single update (`results/p2-graph-ops.md`).

### Memory per session

From the process sampler on value and pilot runs (`sampler.py`): `claude` 260-312 MB; graph server 136-700 MB; serena 165-220 MB plus the TypeScript language server (one node process and 2 `tsserver`) about 285 MB. Each session starts its own servers. At 10 sessions that is roughly 1.4-7 GB for the graph and 4.5-5 GB for serena, before any P3 measurement of CPU.

### Parallel load (P3)

Not run. `p3.sh` is ready (N = 1, 5, 10 sessions, 2 subagents each, default MCP settings, sampler plus per-session MCP logs); see open decision 2.

## Value

Correctness is the task's grade (exact, set F1, build check, or rubric with a Haiku judge and an author spot-check of every judged score). The D-7 rule: a difference counts only if the gap between medians exceeds the larger within-configuration range of the two; cost and wall time count only at equal correctness and at a gap of at least 20%.

Tasks (design D-3): V1 symbol lookup, V2 call sites with same-name decoys, V3 type importers, V4 blast radius of a signature change, V5 change review, V6 architecture overview, V7 dead code, V8 structural rename.

### Haiku 4.5, median [min-max] of 3 runs

| model | task | cfg | n | score | cost USD | wall s | turns | tool calls | graph | serena | Bash | Read |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| haiku | V1 | C0 | 3 | 1 [1-1] | 0.0177 [0.0173-0.022] | 17.8 [15-20] | 3 [3-4] | 2 [2-3] | 0 [0-0] | 0 [0-0] | 1 [1-2] | 1 [1-1] |
| haiku | V1 | CG | 3 | 1 [1-1] | 0.0238 [0.0169-0.0241] | 19.6 [19.4-31.8] | 4 [3-4] | 3 [2-3] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 1 [0-1] |
| haiku | V1 | CS | 3 | 1 [0.8-1] | 0.0264 [0.016-0.0401] | 35.4 [25.2-36.6] | 3 [3-5] | 2 [2-4] | 0 [0-0] | 1 [0-1] | 0 [0-1] | 0 [0-1] |
| haiku | V1 | CGS | 3 | 1 [1-1] | 0.0169 [0.0164-0.0232] | 22.3 [15.6-26.7] | 3 [3-4] | 2 [2-3] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 0 [0-1] |
| haiku | V2 | C0 | 3 | 1 [1-1] | 0.064 [0.0601-0.0964] | 38.1 [33.3-84.3] | 9 [7-12] | 8 [6-11] | 0 [0-0] | 0 [0-0] | 2 [1-6] | 5 [5-6] |
| haiku | V2 | CG | 3 | 1 [1-1] | 0.041 [0.0205-0.0505] | 33 [29.8-169] | 4 [3-6] | 3 [2-5] | 2 [1-2] | 0 [0-0] | 0 [0-1] | 0 [0-1] |
| haiku | V2 | CS | 3 | 1 [0-1] | 0.0574 [0.032-0.111] | 63.1 [60-88.5] | 9 [6-15] | 8 [5-14] | 0 [0-0] | 4 [0-4] | 1 [0-5] | 3 [0-7] |
| haiku | V2 | CGS | 3 | 1 [0-1] | 0.067 [0.0611-0.117] | 69.5 [58.2-82.2] | 10 [8-10] | 9 [7-16] | 0 [0-4] | 0 [0-2] | 1 [0-3] | 6 [1-6] |
| haiku | V3 | C0 | 3 | 0.6 [0.6-1] | 0.0509 [0.0158-0.21] | 33.3 [16.2-246] | 6 [3-35] | 5 [2-34] | 0 [0-0] | 0 [0-0] | 2 [2-29] | 3 [0-5] |
| haiku | V3 | CG | 3 | 0.6 [0.6-0.6] | 0.0312 [0.0261-0.0333] | 33.2 [23.3-39.2] | 5 [5-7] | 4 [4-6] | 0 [0-0] | 0 [0-0] | 4 [3-4] | 0 [0-3] |
| haiku | V3 | CS | 3 | 0.6 [0.6-0.6] | 0.0477 [0.0158-0.0724] | 48.1 [17.1-78.3] | 9 [3-10] | 8 [2-9] | 0 [0-0] | 0 [0-0] | 6 [2-8] | 0 [0-3] |
| haiku | V3 | CGS | 3 | 0.6 [0.6-0.6] | 0.0904 [0.0415-0.106] | 196 [164-197] | 11 [8-16] | 10 [7-15] | 0 [0-0] | 0 [0-0] | 10 [4-12] | 3 [0-3] |
| haiku | V4 | C0 | 3 | 1 [0.95-1] | 0.141 [0.114-0.301] | 59.1 [40-149] | 11 [10-28] | 10 [9-27] | 0 [0-0] | 0 [0-0] | 4 [4-19] | 6 [5-8] |
| haiku | V4 | CG | 3 | 0.95 [0.95-0.95] | 0.102 [0.0836-0.109] | 50.2 [34.8-78.8] | 11 [10-11] | 10 [9-10] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 7 [7-8] |
| haiku | V4 | CS | 3 | 1 [0.95-1] | 0.193 [0.129-0.209] | 84.7 [57.6-109] | 19 [12-21] | 18 [11-20] | 0 [0-0] | 0 [0-0] | 4 [2-14] | 7 [4-7] |
| haiku | V4 | CGS | 3 | 1 [1-1] | 0.148 [0.1-0.224] | 70.9 [50.9-79] | 16 [11-20] | 15 [10-19] | 1 [0-1] | 0 [0-0] | 2 [0-10] | 9 [8-10] |
| haiku | V5 | C0 | 3 | 1 [1-1] | 0.0144 [0.0129-0.0326] | 15.4 [12.7-18.3] | 2 [2-2] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 1 [1-1] | 0 [0-0] |
| haiku | V5 | CG | 3 | 1 [1-1] | 0.0131 [0.012-0.0348] | 17 [13.9-17.1] | 2 [2-2] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 1 [1-1] | 0 [0-0] |
| haiku | V5 | CS | 3 | 1 [1-1] | 0.0329 [0.0118-0.0334] | 15.1 [14.4-17.5] | 2 [2-2] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 1 [1-1] | 0 [0-0] |
| haiku | V5 | CGS | 3 | 1 [1-1] | 0.0126 [0.0118-0.0361] | 16.3 [10.8-17.9] | 2 [2-2] | 1 [1-1] | 0 [0-0] | 0 [0-0] | 1 [1-1] | 0 [0-0] |
| haiku | V6 | C0 | 3 | 0.857 [0.857-0.857] | 0.0662 [0.0642-0.0869] | 33.4 [31.1-39.1] | 12 [10-14] | 11 [9-13] | 0 [0-0] | 0 [0-0] | 5 [4-6] | 5 [5-8] |
| haiku | V6 | CG | 3 | 0.857 [0.857-0.857] | 0.0867 [0.067-0.128] | 41.1 [32.4-51.8] | 16 [10-18] | 15 [9-17] | 0 [0-0] | 0 [0-0] | 5 [2-5] | 10 [7-12] |
| haiku | V6 | CS | 3 | 0.857 [0.714-0.857] | 0.0733 [0.0495-0.0845] | 28.6 [26.3-39.5] | 11 [10-17] | 10 [9-16] | 0 [0-0] | 0 [0-0] | 3 [2-4] | 7 [7-11] |
| haiku | V6 | CGS | 3 | 0.857 [0.857-0.857] | 0.106 [0.0935-0.109] | 56 [53.1-61.1] | 14 [13-15] | 13 [12-14] | 0 [0-0] | 0 [0-0] | 4 [4-8] | 8 [6-9] |
| haiku | V7 | C0 | 3 | 0.435 [0-0.545] | 0.363 [0.163-0.433] | 336 [156-543] | 20 [1-41] | 40 [19-84] | 0 [0-0] | 0 [0-0] | 15 [1-33] | 7 [4-62] |
| haiku | V7 | CG | 3 | 0.588 [0.588-0.588] | 0.194 [0.193-0.222] | 111 [103-136] | 1 [1-1] | 22 [18-37] | 8 [2-16] | 0 [0-0] | 0 [0-0] | 11 [5-12] |
| haiku | V7 | CS | 3 | 0.286 [0.25-0.667] | 0.303 [0.193-0.421] | 274 [162-315] | 1 [1-99] | 118 [98-202] | 0 [0-0] | 115 [92-195] | 1 [1-4] | 1 [0-3] |
| haiku | V7 | CGS | 3 | 0.5 [0-0.588] | 0.224 [0.159-0.364] | 146 [80.3-279] | 1 [1-2] | 27 [20-103] | 2 [1-7] | 5 [1-56] | 0 [0-0] | 11 [1-12] |
| haiku | V8 | C0 | 3 | 1 [1-1] | 0.164 [0.125-0.166] | 56.6 [41.9-64.3] | 18 [16-19] | 17 [15-18] | 0 [0-0] | 0 [0-0] | 3 [1-4] | 5 [5-5] |
| haiku | V8 | CG | 3 | 1 [1-1] | 0.113 [0.0925-0.163] | 54.1 [44.3-55.9] | 18 [18-18] | 17 [17-17] | 0 [0-0] | 0 [0-0] | 3 [3-3] | 5 [5-5] |
| haiku | V8 | CS | 3 | 1 [1-1] | 0.148 [0.139-0.17] | 79.7 [68.5-91.9] | 18 [18-23] | 17 [17-22] | 0 [0-0] | 0 [0-2] | 3 [3-3] | 5 [5-5] |
| haiku | V8 | CGS | 3 | 1 [1-1] | 0.109 [0.1-0.143] | 52.3 [51.3-56] | 16 [16-18] | 15 [15-17] | 0 [0-0] | 0 [0-0] | 1 [1-3] | 5 [5-5] |

### D-7 verdict per comparison and task

| comparison | task | correctness | cost USD | wall s | verdict |
|---|---|---|---|---|---|
| CG vs C0 | V1 | 1.000 vs 1.000 | 0.024 vs 0.018 | 20 vs 18 | no measurable difference |
| CG vs C0 | V2 | 1.000 vs 1.000 | 0.041 vs 0.064 | 33 vs 38 | no measurable difference |
| CG vs C0 | V3 | 0.600 vs 0.600 | 0.031 vs 0.051 | 33 vs 33 | no measurable difference |
| CG vs C0 | V4 | 0.950 vs 1.000 | 0.102 vs 0.141 | 50 vs 59 | no measurable difference (correctness gap within noise) |
| CG vs C0 | V5 | 1.000 vs 1.000 | 0.013 vs 0.014 | 17 vs 15 | no measurable difference |
| CG vs C0 | V6 | 0.857 vs 0.857 | 0.087 vs 0.066 | 41 vs 33 | no measurable difference |
| CG vs C0 | V7 | 0.588 vs 0.435 | 0.194 vs 0.363 | 111 vs 336 | no measurable difference (correctness gap within noise) |
| CG vs C0 | V8 | 1.000 vs 1.000 | 0.113 vs 0.164 | 54 vs 57 | no measurable difference |
| CS vs C0 | V1 | 1.000 vs 1.000 | 0.026 vs 0.018 | 35 vs 18 | no measurable difference; worse wall |
| CS vs C0 | V2 | 1.000 vs 1.000 | 0.057 vs 0.064 | 63 vs 38 | no measurable difference |
| CS vs C0 | V3 | 0.600 vs 0.600 | 0.048 vs 0.051 | 48 vs 33 | no measurable difference |
| CS vs C0 | V4 | 1.000 vs 1.000 | 0.193 vs 0.141 | 85 vs 59 | no measurable difference |
| CS vs C0 | V5 | 1.000 vs 1.000 | 0.033 vs 0.014 | 15 vs 15 | no measurable difference |
| CS vs C0 | V6 | 0.857 vs 0.857 | 0.073 vs 0.066 | 29 vs 33 | no measurable difference |
| CS vs C0 | V7 | 0.286 vs 0.435 | 0.303 vs 0.363 | 274 vs 336 | no measurable difference (correctness gap within noise) |
| CS vs C0 | V8 | 1.000 vs 1.000 | 0.148 vs 0.164 | 80 vs 57 | no measurable difference |
| CGS vs CG | V1 | 1.000 vs 1.000 | 0.017 vs 0.024 | 22 vs 20 | no measurable difference |
| CGS vs CG | V2 | 1.000 vs 1.000 | 0.067 vs 0.041 | 70 vs 33 | no measurable difference |
| CGS vs CG | V3 | 0.600 vs 0.600 | 0.090 vs 0.031 | 196 vs 33 | no measurable difference; worse wall |
| CGS vs CG | V4 | 1.000 vs 0.950 | 0.148 vs 0.102 | 71 vs 50 | better |
| CGS vs CG | V5 | 1.000 vs 1.000 | 0.013 vs 0.013 | 16 vs 17 | no measurable difference |
| CGS vs CG | V6 | 0.857 vs 0.857 | 0.106 vs 0.087 | 56 vs 41 | no measurable difference |
| CGS vs CG | V7 | 0.500 vs 0.588 | 0.224 vs 0.194 | 146 vs 111 | no measurable difference (correctness gap within noise) |
| CGS vs CG | V8 | 1.000 vs 1.000 | 0.109 vs 0.113 | 52 vs 54 | no measurable difference |
| CGS vs C0 | V1 | 1.000 vs 1.000 | 0.017 vs 0.018 | 22 vs 18 | no measurable difference |
| CGS vs C0 | V2 | 1.000 vs 1.000 | 0.067 vs 0.064 | 70 vs 38 | no measurable difference |
| CGS vs C0 | V3 | 0.600 vs 0.600 | 0.090 vs 0.051 | 196 vs 33 | no measurable difference |
| CGS vs C0 | V4 | 1.000 vs 1.000 | 0.148 vs 0.141 | 71 vs 59 | no measurable difference |
| CGS vs C0 | V5 | 1.000 vs 1.000 | 0.013 vs 0.014 | 16 vs 15 | no measurable difference |
| CGS vs C0 | V6 | 0.857 vs 0.857 | 0.106 vs 0.066 | 56 vs 33 | no measurable difference; worse cost, wall |
| CGS vs C0 | V7 | 0.500 vs 0.435 | 0.224 vs 0.363 | 146 vs 336 | no measurable difference (correctness gap within noise) |
| CGS vs C0 | V8 | 1.000 vs 1.000 | 0.109 vs 0.164 | 52 vs 57 | better (cost) |

Per server:

- **code-review-graph (CG vs C0): fails value.** No task is measurably better. The biggest gaps are V7 (0.588 vs 0.435, 111 vs 336 s) and V2 cost (0.041 vs 0.064 USD), both inside C0's run-to-run range (V7 C0 correctness 0-0.545, wall 156-543 s). V7 is the one task where the graph looks consistently useful (all three CG runs 0.588, 103-136 s); it is also the one task the graph's `refactor_tool` answers directly.
- **serena (CS vs C0): fails value.** No task better; V1 wall time worse (35 vs 18 s). On V7 serena produced 98-202 tool calls per run (249 `find_referencing_symbols` over its 3 runs) and the lowest scores.
- **serena on top of the graph (CGS vs CG, R-16's comparison): fails value.** V4 better by one package item (1.0 vs 0.95, zero range on both sides), V3 wall time worse (196 vs 33 s).
- **Both (CGS vs C0).** V8 cheaper (0.109 vs 0.164 USD); V6 dearer and slower (0.106 vs 0.066 USD, 56 vs 33 s).

Why so little: on this repository `grep` + `Read` answer most questions in a few calls; V5 is at the ceiling (all 12 runs 1.0 with one `git diff`); V6 does not discriminate (0.857 everywhere but one run); in V3 the model mostly skipped MCP even when present. Per-task tool use is in the table's `graph` and `serena` columns.

### Sonnet 5 confirmation slice (1 run per cell)

| model | task | cfg | n | score | cost USD | wall s | turns | tool calls | graph | serena | Bash | Read |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sonnet | V2 | C0 | 1 | 1 | 0.143 | 28.5 | 5 | 4 | 0 | 0 | 4 | 0 |
| sonnet | V2 | CG | 1 | 1 | 0.147 | 53.5 | 5 | 4 | 0 | 0 | 4 | 0 |
| sonnet | V2 | CS | 1 | 1 | 0.153 | 47 | 6 | 5 | 0 | 0 | 5 | 0 |
| sonnet | V2 | CGS | 1 | 1 | 0.109 | 34 | 4 | 3 | 0 | 0 | 3 | 0 |
| sonnet | V4 | C0 | 1 | 1 | 0.245 | 71.6 | 12 | 11 | 0 | 0 | 7 | 4 |
| sonnet | V4 | CG | 1 | 1 | 0.306 | 85.7 | 15 | 14 | 0 | 0 | 9 | 5 |
| sonnet | V4 | CS | 1 | 1 | 0.274 | 84.4 | 14 | 13 | 0 | 0 | 12 | 1 |
| sonnet | V4 | CGS | 1 | 1 | 0.267 | 85.7 | 13 | 12 | 0 | 0 | 8 | 4 |
| sonnet | V5 | C0 | 1 | 1 | 0.102 | 20.3 | 3 | 2 | 0 | 0 | 1 | 1 |
| sonnet | V5 | CG | 1 | 1 | 0.11 | 23 | 3 | 2 | 0 | 0 | 1 | 1 |
| sonnet | V5 | CS | 1 | 1 | 0.103 | 40.4 | 3 | 2 | 0 | 0 | 1 | 1 |
| sonnet | V5 | CGS | 1 | 1 | 0.113 | 29.7 | 3 | 2 | 0 | 0 | 1 | 1 |
| sonnet | V8 | C0 | 1 | 1 | 0.118 | 29.2 | 5 | 4 | 0 | 0 | 4 | 0 |
| sonnet | V8 | CG | 1 | 1 | 0.128 | 45.7 | 5 | 4 | 0 | 0 | 4 | 0 |
| sonnet | V8 | CS | 1 | 1 | 0.121 | 45.7 | 5 | 4 | 0 | 0 | 4 | 0 |
| sonnet | V8 | CGS | 1 | 1 | 0.143 | 47.2 | 6 | 5 | 0 | 0 | 5 | 0 |

Every cell scores 1.0 and no run made an MCP call: the ranking does not flip in favour of the servers. With one run per cell the cost and wall-time differences are not interpretable; the point is that no configuration used the servers at all.

### Raw runs

Every valid run, one row each, with its raw file: `results/value-runs.md` (112 rows); discarded attempts with the reason: `runs/_invalid/`.

## Failure mode and availability

| run | status at `init` | calls to missing tools | fallback | correctness | cost USD (normal median) | wall s (normal median) |
|---|---|---|---|---|---|---|
| V1 CG | graph `pending`, 0 MCP tools | 1 `ToolSearch` for `semantic_search_nodes_tool`: "No matching deferred tools found. Some MCP servers are still connecting" | `grep -r`, `Read` | 1.0 | 0.045 (0.024) | 24.9 (19.6) |
| V1 CS | serena `pending`, 0 MCP tools | none | `grep -r`, `Read` | 1.0 | 0.039 (0.026) | 14.9 (35.4) |
| V2 CG | graph `pending`, 0 MCP tools | none | `grep -rn`, 6 `Read` | 1.0 | 0.101 (0.041) | 49.1 (33.0) |
| V2 CS | serena `pending`, 0 MCP tools | none | `grep -rn`, 6 `Read` | 1.0 | 0.084 (0.057) | 32.5 (63.1) |

(`results/failure-mode.md`, raw in `runs/failure/`.) In default sessions a slow server is `pending` at `init`, its tools never appear, and the model uses `grep` + `Read`; the tier text costs at most one `ToolSearch`. What can see connect status (`results/availability.md`): the `SessionStart` hook input has no MCP field; `claude mcp list` inside a hook starts every server a second time and once hung session start for more than 5 minutes; the `init` event says `pending` in the default nonblocking start; T01's Init payload has only `mcp_tool_count`. **Recommendation:** if any MCP tier remains, it names its fallback in the same fragment rather than depending on availability detection.

A harness finding that matters for anyone setting timeouts: `MCP_TIMEOUT` (default 30000) is the per-server connect timeout; `MCP_CONNECT_TIMEOUT_MS` (default 5000) is only how long start-up waits for pending servers (`README.md`, Headless invocation).

## Update strategy

Moot under the recommended disposition. If the graph stays in any form (open decision 1): no `Stop` hook; `update` on demand in the skill that is about to query the graph (1-2 s per call, `results/p2-graph-ops.md`); never from a hook that runs per reply.

## Pins

| Server | Spec measured (unpinned) | Pin candidates | Re-resolved at start? | P1 warm / cold median s |
|---|---|---|---|---|
| code-review-graph | `uvx code-review-graph serve` (resolved to 2.3.9, the latest on PyPI on 2026-09-25) | `uvx code-review-graph==2.3.9 serve` | No for either form once cached: both start with `UV_OFFLINE=1`. `uvx code-review-graph` also reuses a matching `uv tool install` of the package (this host has 2.3.9 installed as a uv tool), so a user's own install silently decides the version of the unpinned spec. | unpinned 1.31 / 41.05; pinned 1.29 / 37.15 |
| serena | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` (HEAD `7a29683`) | `git+https://github.com/oraios/serena@7a2968335f2198b966864de1ce3655c8e485a653` (the measured code); `serena-agent==1.7.0` (PyPI release of 2026-08-09, `v1.7.0` = `949a27e`, 153 commits and 300 files behind the measured HEAD; supports every flag BDK passes: `--context`, `--project-from-cwd`, modes `interactive`, `editing`, `no-memories`) | Unpinned: yes, every start queries `https://api.github.com/repos/oraios/serena/commits/HEAD` (`uvx -v`) and fails offline; that is unauthenticated GitHub API traffic per session (rate limit 60 per hour per IP). SHA and PyPI pins: no, both start with `UV_OFFLINE=1`. | HEAD 1.85 / 22.09; SHA 1.71 / 24.28; PyPI 1.83 / 33.14 |

(`results/pins.md`.) Only relevant if a server stays: pin serena to the measured SHA (the PyPI release is 153 commits older), pin the graph to `==2.3.9`. The unpinned serena spec queries the GitHub API at every start.

## R-7: does `scout` stay one adapter?

Yes. In the value runs the orchestrator did V1-V4 itself (one `bdk:explorer` spawn in 48 runs), and V7 spawned `bdk:dead-code-detector` in 9 of its 12 runs, in every configuration. The explorer-type work used graph `semantic_search_nodes` / `query_graph` / `traverse_graph` and serena `find_symbol` / `get_symbols_overview`; the dead-code work used the same plus graph `refactor_tool` and `list_graph_stats`, serena `find_referencing_symbols`, and `Read` / `Grep` / `Glob` throughout (`runs/haiku/V2/CGS-r*.jsonl`, `runs/haiku/V7/*.jsonl`). The only tool one needs and the other lacks is `refactor_tool`, which goes with the graph. Without MCP, all four former agents need the same read-only set (`Read`, `Grep`, `Glob`, `Bash`). `log-analyzer` and `duplicate-detector` had no task of their own; nothing in the data argues for splitting them out.

## Tier menu vs agent `tools:` drift

| Agent | Preloaded tiers | Named in the graph tier, not granted | Named in the serena tier, not granted |
|---|---|---|---|
| `architecture-reviewer` | explore, search, impact | `find_large_functions_tool`, `get_community_tool`, `get_knowledge_gaps_tool`, `traverse_graph_tool` | - |
| `design-verifier` | search, explore | `find_large_functions_tool`, `get_community_tool`, `get_flow_tool`, `get_hub_nodes_tool`, `get_knowledge_gaps_tool`, `get_surprising_connections_tool`, `list_graph_stats_tool`, `traverse_graph_tool` | - |
| `explorer` | explore, search | `get_community_tool`, `get_hub_nodes_tool`, `get_surprising_connections_tool` | - |
| `plan-verifier` | search, impact, explore | `find_large_functions_tool`, `get_community_tool`, `get_hub_nodes_tool`, `get_knowledge_gaps_tool`, `get_surprising_connections_tool`, `list_communities_tool` | - |
| `implementer` | search, impact, edit | - | `rename_symbol`, `safe_delete_symbol` |
| `fixer` | search, impact, edit | - | `rename_symbol`, `safe_delete_symbol` |

(`results/tier-tools-drift.md`.) Six agents are told to use tools they are not granted. Under the recommended disposition the list disappears with the MCP tiers; if any MCP tier stays, T42 needs a content test that every tool a preloaded tier names is in the agent's `tools:`.

## Downstream changes (recommended disposition: both removed)

| Task | Change |
|---|---|
| T11 `doctor` | No `uv` / `uvx` check (nothing in v3 needs them once `uv.lock` goes with T32). |
| T13 `ctx` and content hooks | No `uvx` lines in `hooks.json`; `hooks session-start` drops graph repo registration; `ctx skill` tier chains carry only the fallback tier, so the acceptance test "`features.code-review-graph` gives the graph tier" becomes "tier text is the fallback with or without the flag", and `features.code-review-graph` / `features.serena` become unknown keys (an error in v3, or a documented removal in `config check`). |
| T32 import and cleanup | Remove `serena` and `code-review-graph` from `.mcp.json` (the file goes if empty), `hooks/register-graph-repo/`, the `Stop` graph line if still present, and `.serena/`; `uv.lock` is not needed for MCP; the v2 -> v3 import reports the dropped `features` keys. |
| T41 stage skills | Tool-tier guidance is the fallback text; CI content test "`mcp__plugin_bdk_` in tool names" becomes "no `mcp__plugin_bdk_` names". |
| T42 roles and adapters | Adapter `tools:` without MCP tools; `scout` = `Read`, `Grep`, `Glob`, `Bash` (R-7 answer); the drift list above needs no test. |
| BDK dev-time rules | `.claude/rules/mcp-tool-naming.md` and the MCP part of `.claude/rules/fragment-system.md` are retired with v3; the repo's own `CLAUDE.md` graph section is the user's choice (it is not part of the plugin). |

## Open decisions

1. **Disposition.** Recommendation: **remove both** as D-7 says. Alternative: keep code-review-graph opt-in (off by default, enabled by a `features` flag, with its tier and the fixes above), on the strength of V7 alone. That would be a judgement against the rule, and it would need P3 first.
2. **P3 parallel load.** Recommendation: **do not run it** for this decision; it cannot change a "removed" verdict and it loads the user's machine for about an hour. Run it only if decision 1 keeps a server.
3. **Scope of the result.** The benchmark is one TypeScript monorepo with Haiku doing the work. Recommendation: accept it for v3 and state the stack in the plan; if a user on another stack wants a server, the harness in `docs/v3/t03-mcp-eval/` reruns on their repository with one `prepare.sh` per configuration.
4. **Gate budgets** (design open question). Recommendation: close without setting them; they only matter if a server stays.
