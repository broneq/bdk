# Design

## Context

See proposal.md - Why and What Changes for motivation and the resolved "To resolve in the spec" items.

Facts that shape the approach (observed 2026-09-25):

- `.mcp.json` starts both servers through `uvx` with no pin: serena from `git+https://github.com/oraios/serena` (HEAD, modes `interactive`, `editing`, `no-memories`, context `claude-code`), code-review-graph as `uvx code-review-graph serve` (resolves to 2.3.9 today).
- code-review-graph keeps its database in `<repo>/.code-review-graph/graph.db`. Each worktree therefore has its own graph (built and updated separately), while subagents inside one worktree share that worktree's graph.
- serena starts one server per session, and each server starts its own language servers for the project (here: the TypeScript server only, see D-1). N parallel sessions mean N language server processes.
- The v2 hotfix `cdea721` (branch `fix/stop-hook-graph-update`) removes the `Stop` hook's `uvx code-review-graph update`. v2.6.0 still has it. Both are available as baselines.
- The user's machine also has serena and code-review-graph configured at user level (unprefixed `mcp__serena__*`, `mcp__code-review-graph__*`) and several user-level plugins. A "no MCP" run is only valid if those are excluded too.
- The user's load profile: 5-10 Claude Code sessions in parallel, each in its own worktree, each spawning subagents in the same worktree.

## Goals / Non-Goals

**Goals:**
- A disposition per server that holds under the user's real load, not only in a single idle session.
- Numbers someone else can reproduce: pinned benchmark commit, pinned server versions, committed task set, reference answers and harness.
- Token spend on the measurement kept low: cheap models for the runs, no Opus.

**Non-Goals:**
- A general MCP benchmark or a reusable harness (T40 builds that).
- Tuning the servers (serena modes, graph embeddings) beyond what the update strategy and pinning questions need.

## Decisions

### D-1 Benchmark repository: vibe-kanban at `f4b0fd9`

`BloopAI/vibe-kanban`, commit `f4b0fd955c1b6c94ff7907ca6b8b96eab9c6364a` (v0.1.32, 2026-03-18), 2116 tracked files. Measured on its **TypeScript part only**: the pnpm workspace `packages/*` (`web-core` 391, `ui` 163, `remote-web` 70, `local-web` 32 `.ts` / `.tsx` files) plus `shared/types.ts`, the types generated from the Rust backend. Tasks, reference answers and verification (`tsc` via each package's `check` script) stay inside that part. serena's project config lists `typescript` only. The graph parses the whole repository as it would in normal use, so its build and update cost includes the Rust files; the value tasks do not touch them. Cloned fresh into the session scratch area (not the existing `~/projects/vibe-kanban`, which carries its own `.code-review-graph/` and `.serena/`), and worktrees are created from that clone.

Why TypeScript only: the machine has no Rust toolchain (no `cargo`, `rustup` or `rust-analyzer`), and the user's own repositories are mostly TypeScript and PHP, so a `rust-analyzer` cost would not describe the user's load. Installing rustup was the alternative (about 1.5 GB plus several GB of `target/`, and a second stack in the performance gate that the user does not work in). User decision.

Alternatives for the repository: `ocean-recap` (larger, about 2480 TS files, but private: task texts and reference answers could not be committed); `code-graph-rag` (public, 340 Python files: too small and single-language to load the servers). User decision.

### D-2 Four configurations, each server judged on its own

| ID | MCP servers | BDK `features` | Judges |
|---|---|---|---|
| C0 | none | graph off, serena off | baseline |
| CG | code-review-graph | graph on | graph vs C0 |
| CS | serena | serena on | serena vs C0 |
| CGS | both | both on | serena on top of graph (R-16's comparison) and the pair vs C0 |

Each run loads BDK from a fixed commit (`cdea721`, v2.6.0 without the graph `Stop` hook) with `.bdk/settings.json` features set to match, so the tier fragments the model sees match the servers it has. MCP servers come only from the configuration's `--mcp-config` file under `--strict-mcp-config`; user-level plugins, user MCP servers and user `CLAUDE.md` are excluded. The harness verifies isolation from the `system` / `init` event of each run (listed MCP servers, tools, plugins) and discards a run whose init does not match its configuration.

Alternatives: the plan's three configurations (serena only as an add-on to the graph, so serena's value is unknown if the graph goes); pair only (cannot give a per-server disposition). User decision.

### D-3 Task set: 8 tasks over the tiers

Each task is a single prompt run headless in a per-configuration worktree of a history-free snapshot of `f4b0fd9` (same tree, one commit, so `git log` cannot reveal V5's fix), reset to the snapshot before every run while keeping `node_modules`, the built graph and serena's cache; setup and flags in `docs/v3/t03-mcp-eval/README.md`. Concrete targets (symbol names, the commit for the review task) are chosen in the first task group and fixed, with reference answers, in `docs/v3/t03-mcp-eval/tasks/` and committed before the first measured run.

| # | Tier | Task shape | Reference answer | Grading |
|---|---|---|---|---|
| V1 | search | Find where a named exported function or hook is defined and give its signature | file:line + signature | exact match |
| V2 | trace | List every call site of a function used across several packages | set of file:line | precision / recall |
| V3 | trace | List the consumers of one type from `shared/types.ts` across the packages | set of files | precision / recall |
| V4 | impact | Given a signature change to a function, list the files and tests that must change | set of files | precision / recall |
| V5 | review | Review the diff of a real bug-introducing commit (the parent of a later fix) and name the defect | the defect the fix commit repaired | rubric, judged |
| V6 | explore | Describe the package layering and dependency direction of the pnpm workspace | package graph from `package.json` dependencies and import paths | rubric, judged |
| V7 | scout | Find unused exported functions in one package | list checked by removing them and running the package's `check` | precision / recall |
| V8 | edit | Rename a symbol used in several files | old name gone, `check` passes | build + grep, binary |

V1-V4 and V7 are the `scout` adapter's former agents' work (explorer, dead-code-detector), so the per-task tool usage answers R-7's merge question. Correctness is a 0-1 score per run. The judge for V5 / V6 is Haiku 4.5 with the committed rubric, and the author spot-checks every judged score.

Alternatives: using BDK's own repository (38 files, excluded by the plan); synthetic tasks (no real call graphs, flatters the graph).

### D-4 Models: Haiku 4.5 for runs, a Sonnet 5 slice as a check

All value runs (8 tasks x 4 configurations x 3 runs = 96) run on Haiku 4.5, which is also the model of today's `explorer` and of the `scout` adapter. A confirmation slice runs V2, V4, V5 and V8 once per configuration on Sonnet 5 (16 runs) to check that the ranking of configurations does not flip with a stronger model. If it flips, the evaluation reports it as a finding rather than rerunning the whole set on Sonnet. Opus is never used. The load runs (D-6) also use Haiku 4.5.

Alternative: every run on Sonnet 5 (roughly 3x the cost, contrary to the user's direction to save tokens).

### D-5 Metrics per value run

From `claude -p --output-format stream-json --verbose`: `total_cost_usd`, token usage (input, output, cache creation, cache read), `num_turns`, tool calls by name (MCP vs `Read` / `Grep` / `Glob` / `Edit`), `duration_ms`, MCP server connect status from `init`. Raw JSON per run is kept in `docs/v3/t03-mcp-eval/runs/`.

### D-6 Cost measurement, with the user's parallel load as the gate

- **P1 Connect**: time to connected and failure rate per server, 10 starts each with a warm `uv` cache, 3 with a cleared one; unpinned vs pinned spec (serena from git HEAD vs a pinned SHA or PyPI release; graph unpinned vs `==2.3.9`), since `uvx --from git+...` may resolve the source on every start.
- **P2 Graph operations** on a vibe-kanban worktree: full build, `update` with no change, with 1 and with 20 changed files, with and without `--skip-flows`, and `postprocess`; CPU seconds and peak RSS from `/usr/bin/time -l`, wall time, `graph.db` size.
- **P3 Parallel load**: N = 1, 5, 10 sessions at once, each in its own worktree, each running one mid-size task that spawns 2 subagents in the same worktree, for every configuration. Graph configurations run twice, without and with the v2.6.0 `Stop` hook. A 1 s sampler records host CPU, load average and RSS summed per process family (`claude`, serena, language servers, code-review-graph, `uv`), plus per-session wall time, connect failures and graph lock or database errors.
- **Update strategies** (graph only, under P3 at N = 10): none plus on-demand update in the skills that use the graph; `Stop` hook as in v2.6.0; `Stop` hook with a per-worktree lock and a 60 s debounce; `code-review-graph watch` per worktree. Each is scored on CPU and on staleness (V2 run after an edit, answer checked against the edited code).

### D-7 Threshold

A server is **default-on** only if it passes both:

1. **Value** (R-16 generalised): versus its comparison in D-2, correctness is higher, or correctness is equal and median `total_cost_usd` or median wall time is at least 20% lower. A difference counts only if the gap between medians exceeds the larger within-configuration range (max - min over the 3 runs) of the two configurations.
2. **Performance gate** at N = 10 (P3), versus C0 at N = 10: median session wall time no more than 10% worse; the server's process families add on average at most 1 CPU core and at most 300 MB RSS per session; connect failure rate at most 2% over all P1 and P3 starts.

A token saving does not offset a failed performance gate (user direction). **Opt-in**: passes value, fails the gate at N = 10 but passes it at N = 1. **Removed**: fails value, or fails the gate even at N = 1.

Alternatives: R-16 exactly, without the gate (would keep a server that slows the user's machine); correctness only (ignores cost entirely).

### D-8 Failure mode

With a server configured but forced to miss `CONNECT_TIMEOUT` (a wrapper that sleeps past 30 s), run V1 and V2 in the tier that expects it and record what the agent does: calls to missing tools, fallback to `Grep` / `Read`, wasted turns, wrong answers. Then check whether BDK can see availability at all: what the `SessionStart` hook input and T01's recorded payloads contain, and whether `claude mcp list` or the `init` event exposes connect status to a hook or the kernel. The evaluation recommends one of: tier selected by availability (if observable), tier text that tells the model to fall back when the tools are absent, or both.

### D-9 Pinning

For each server that stays: the exact spec (PyPI version, or git SHA if no release exists), whether `uvx` re-resolves it at start, and the P1 connect time with the pin. This is the input to T32's `uv.lock` question; T03 does not decide it.

## Risks / Trade-offs

- [Haiku uses the MCP tools less, or worse, than Sonnet, which would undersell the servers] -> the Sonnet 5 slice (D-4) checks whether the ranking flips, and the evaluation reports it if so.
- [3 runs per cell is a small sample; noise may hide or fake a 20% gain] -> the range-based noise rule in D-7 is conservative; a borderline cell is reported as "no measurable difference", never as a win.
- [Isolation leaks: a user-level MCP server or plugin ends up in a C0 run] -> per-run `init` check (D-2); a non-matching run is discarded and rerun.
- [P3 at N = 10 loads the machine the user is working on and can disturb their sessions, and skew the numbers] -> P3 runs only when the user confirms the machine is otherwise idle; the sampler records background load, and a batch is repeated if background load exceeds 1 core.
- [TypeScript server indexing dominates serena's cost and depends on `node_modules` being present] -> every worktree gets `node_modules` from the shared pnpm store (`pnpm install --frozen-lockfile --offline`), so the cost matches normal work; P1 / P3 record the install state.
- [TypeScript only leaves serena's value on other stacks unknown] -> the evaluation states the stack its dispositions hold for; a user on another stack reads them as a TypeScript result.
- [The review task's reference depends on a commit whose fix may be ambiguous] -> V5's commit is chosen so the fix commit's message and diff name exactly one defect.
- [Token cost of the measurement] -> estimate: about 112 value runs plus about 100 load sessions (16 sessions per P3 configuration pass, 6 passes), almost all on Haiku 4.5. The harness prints the running `total_cost_usd` and stops at a budget of USD 50 unless the user raises it.

## Migration Plan

None. T03 only adds documents and data. Downstream edits (T11, T13, T32, T41, T42) happen in those tasks, driven by the dispositions.

## Open Questions

- Exact performance-gate budgets in D-7 (10% wall time, 1 core, 300 MB per session, 2% connect failures). They do not change the approach or the tasks, only where the line falls when the numbers are in; the user may tighten them before the dispositions are read off.
