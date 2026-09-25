# Tasks

## 1. Benchmark setup and isolation

- [x] 1.1 Clone `BloopAI/vibe-kanban` fresh into the session scratch area, check out `f4b0fd9`, install the pnpm workspace once (`pnpm install --frozen-lockfile`) so the store is warm for worktrees, and verify `git rev-parse HEAD` and each package's `check` script (`tsc`) succeed
- [x] 1.2 Write the four MCP configuration files (C0, CG, CS, CGS) and the matching `.bdk/settings.json` feature sets into `docs/v3/t03-mcp-eval/configs/`, with the servers exactly as in today's `.mcp.json`; verify each parses as JSON
- [x] 1.3 Find the `claude -p` flags that exclude user-level plugins, user MCP servers and user `CLAUDE.md` while loading BDK from `cdea721` via `--plugin-dir`; verify with one trivial run per configuration that the `init` event lists exactly the intended MCP servers and plugins, and record the flags in `docs/v3/t03-mcp-eval/README.md`

## 2. Task set and reference answers (committed before any measured run)

- [x] 2.1 Pick the concrete targets for V1-V8 (design D-3) in vibe-kanban at `f4b0fd9`, including the bug-introducing commit for V5, and write one prompt file per task into `docs/v3/t03-mcp-eval/tasks/`; verify each prompt names its target unambiguously and fits one headless run
- [x] 2.2 Write the reference answer per task by hand from the code (sets of file:line, package graph from `package.json` and imports, defect of V5's fix commit, V7 list confirmed by removing the functions and running `check`) and the V5 / V6 rubrics; verify V7 and V8 references with the package's `check`, and the rest by a second read against the code
- [x] 2.3 Commit the task set and references on the branch; verify the commit precedes every file in `docs/v3/t03-mcp-eval/runs/` in `git log`

## 3. Harness and pilot

- [x] 3.1 Write the harness `docs/v3/t03-mcp-eval/run.sh` (per-configuration worktree of the snapshot reset before every run, configuration, model, task; `stream-json` output saved raw; `init` isolation check; running `total_cost_usd` with a USD 50 stop) and the grader for the deterministic tasks (V1-V4, V7, V8); verify the grader scores the reference answers 1.0 and an empty answer 0.0
- [x] 3.2 Write the process sampler for load runs (1 s interval; host CPU, load average, RSS per process family: `claude`, serena, language servers, code-review-graph, `uv`); verify on one CGS run that every family appears in the samples
- [x] 3.3 Pilot: V1 once per configuration on Haiku 4.5; verify each run passes the isolation check, is graded, and its metrics (design D-5) are extracted into the results table

## 4. Cost: connect and graph operations

- [x] 4.1 P1: 10 warm-cache and 3 cold-cache starts per server, unpinned and pinned (design D-6, D-9); record time to connected and failures; verify the table in `docs/v3/t03-mcp-eval/results/p1-connect.md` has all cells with raw times
- [x] 4.2 P2: full build, `update` with no change, 1 and 20 changed files, with and without `--skip-flows`, and `postprocess` on one worktree; record CPU seconds, peak RSS, wall time, `graph.db` size; verify `results/p2-graph-ops.md` has every operation with raw `/usr/bin/time -l` output kept

## 5. Value runs

- [x] 5.1 Run V1-V8 x C0 / CG / CS / CGS x 3 on Haiku 4.5 (96 runs); verify 96 raw run files exist, each passes the isolation check (rerun any that do not), and each has a correctness score
- [x] 5.2 Grade V5 and V6 with the Haiku 4.5 judge and the committed rubric, then spot-check every judged score by hand; verify each judged score has the judge output and the spot-check note next to it
- [x] 5.3 Run the Sonnet 5 confirmation slice (V2, V4, V5, V8 x 4 configurations x 1); verify whether the ranking of configurations per task matches the Haiku medians and record the result
- [x] 5.4 Build the value table (per task and configuration: median and range of correctness, `total_cost_usd`, tokens, turns, tool calls by kind, wall time) with raw numbers per run; apply the D-7 value rule per server and verify each verdict cites the cells it rests on
- [x] 5.5 From the V1-V4 and V7 tool-call data, answer R-7's `scout` merge question (do the four former agents need different tool sets); verify the answer cites the per-task tool usage

## 6. Parallel load and update strategy

- [x] 6.1 Confirm with the user that the machine is otherwise idle, then run P3 (N = 1, 5, 10; every configuration; graph configurations also with the v2.6.0 `Stop` hook), each session spawning 2 subagents in its worktree; verify every batch has sampler output, per-session wall time and connect status, and that background load stayed under 1 core (repeat the batch otherwise) - **Not run** (user decision 2026-09-25): both servers fail the D-7 value rule, so they are removed whatever the gate shows; `p3.sh` stays in the harness for a rerun.
- [x] 6.2 Run the four update strategies (design D-6) under P3 at N = 10 with the graph configuration, then a V2 run after an edit per strategy to measure staleness; verify each strategy has CPU, lock or database errors, and the staleness result - **Not run** (user decision 2026-09-25): both servers fail the D-7 value rule, so they are removed whatever the gate shows; `p3.sh` stays in the harness for a rerun.
- [x] 6.3 Apply the D-7 performance gate per server at N = 10 and N = 1; verify each verdict cites the P1 and P3 cells it rests on - **Not run** (user decision 2026-09-25): both servers fail the D-7 value rule, so they are removed whatever the gate shows; `p3.sh` stays in the harness for a rerun.

## 7. Failure mode and pinning

- [x] 7.1 Run V1 and V2 with each server forced past `CONNECT_TIMEOUT` (design D-8); record calls to missing tools, fallback, wasted turns and correctness; verify the raw runs are kept and the behaviour is summarised per server
- [x] 7.2 Check what `SessionStart` input, T01's recorded payloads, `claude mcp list` and the `init` event expose about MCP connect status; verify each source is cited (file, doc section or captured output) and give the recommendation for tier selection by availability
- [x] 7.3 Record the exact pin spec per server that may stay, whether `uvx` re-resolves it at start, and its P1 connect time; verify the spec starts the server in a clean shell

## 8. Evaluation document and acceptance

- [x] 8.1 Write the evaluation (first as `docs/V3-MCP-EVALUATION.md`; by user decision it became `docs/adr/0001-remove-bundled-mcp-servers.md`, which replaces it): baseline (commits, versions, harness flags), cost table, per-task value table with raw numbers next to the summary, per server a disposition (default-on / opt-in / removed) with rationale, the update strategy, the failure-mode recommendation, pins, the R-7 answer, the tier-menu vs agent `tools:` drift list, the resulting changes per downstream task (T11 `doctor`, T13 hook lines, T32 `uv.lock`, T41 / T42 tier fragments and agent `tools:`), and open decisions for the user with a recommendation each; verify every number in the summary traces to a raw file
- [ ] 8.2 After the user decides on the dispositions, add the T03 Resolution paragraph to `docs/V3-IMPLEMENTATION-PLAN.md` and the downstream edits it causes, and update issue #68; verify the plan's T11, T13, T32, T41 and T42 sections name T03's outcome where it changes them
- [ ] 8.3 Check the Acceptance signal end to end: the document exists with the cost table, the value table with all configurations and runs, a disposition with rationale per server, downstream changes per task, and open decisions with recommendations; then run `openspec validate v3-t03-mcp-value-evaluation --strict` and verify it passes
