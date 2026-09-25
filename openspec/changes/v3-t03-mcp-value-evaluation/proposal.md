# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T03. Tracks #68.

v3 carries both bundled MCP servers (serena, code-review-graph) by assumption: T13 keeps the `uvx` lines, T11 `doctor` checks `uv`, T32 asks whether `uv.lock` stays, and every tool tier and agent `tools:` list depends on them. The plan's T03 "Why now" list shows the assumption is not free (unlocked graph updates after every reply, unpinned `uvx` servers timing out at connect, tiers chosen by flag rather than availability, tier menus drifting from agent `tools:`), and the 30-day usage counts show the tools are called but not that they save anything. T03 replaces the assumption with a measured disposition per server before T13, T32, T41 and T42 build on it.

The user's working setup sets the bar: 5-10 Claude Code sessions run in parallel, each in its own worktree, and each spawns subagents in its worktree. A server that saves tokens but makes the machine or the session slower under that load is not worth it, so host performance under parallel load is a gate, not one metric among many.

## What Changes

- New document `docs/V3-MCP-EVALUATION.md`: the cost table, the per-task value table (all configurations and runs, raw numbers next to the summary), a disposition per server (**default-on / opt-in / removed**) with rationale, the resulting changes per downstream task, and open decisions for the user with a recommendation each.
- New directory `docs/v3/t03-mcp-eval/` with what makes the numbers reproducible: the task set with reference answers (written and committed before the first run), the four MCP configurations, the harness (a shell script around `claude -p --output-format json`), and the raw per-run results.
- Resolutions of the plan's "To resolve in the spec" items (details in design.md):
  - **Benchmark repository**: `BloopAI/vibe-kanban`, public, pinned at `f4b0fd9` (v0.1.32, 2116 tracked files), measured on its TypeScript part only (about 660 `.ts` / `.tsx` files in five pnpm packages plus `shared/`). Public so reference answers and raw results can be committed. TypeScript only because the machine has no Rust toolchain and TypeScript matches the user's working stack; serena runs with the `typescript` language server only. User decisions, 2026-09-25.
  - **Configurations**: four, judged per server - no MCP, graph only, serena only, graph + serena. The plan lists three; serena only is added so serena's value is known even if the graph is removed. User decision, 2026-09-25.
  - **Threshold**: R-16's rule generalised to both servers (correctness up, or at equal correctness at least 20% fewer median tokens or wall time, beyond run-to-run spread), with a host performance gate under the user's parallel load that a token saving cannot buy back. User decision, 2026-09-25.
  - **Task set and reference answers**: 8 tasks over the tiers, fixed in design.md; reference answers written before any run.
  - **Models**: value runs on the cheapest model that still exercises the tools (Haiku 4.5), with a small Sonnet 5 confirmation slice; never Opus. User direction, 2026-09-25.
- The same data answers T02 decision R-7's open point: whether the `scout` adapter's four former agents (`explorer`, `log-analyzer`, `dead-code-detector`, `duplicate-detector`) stay merged.

Inputs carried by citation, not restated: plan T03 "Why now" and "Scope"; `hooks/hooks.json`; `.mcp.json`; `fragments/tool-tiers/`; `.claude/rules/fragment-system.md`; `.claude/rules/mcp-tool-naming.md`; agent `tools:` in `agents/*.md`; T02 decisions R-7 and R-16 (`docs/V3-SKILL-INVENTORY.md`, section 12) and the `scout` row of section 13.2; design "Integration points" (`.mcp.json` for serena and code-review-graph); local transcripts for usage data; the v2 hotfix `cdea721` (Stop hook removed) as the v2 baseline.

Out of scope:
- Changing `.mcp.json`, hooks, tier fragments or agent `tools:` (T13, T41, T42 act on T03's dispositions; T03 lists what each must change).
- The promptfoo harness and the A/A noise floor for skills (T40). T03's harness is a lightweight precursor and is not reused as T40's.
- Deciding `uv.lock` for the Python cut (T32); T03 supplies the pinning input only.
- Fixing the tier-menu vs agent `tools:` drift (T41 / T42); T03 records the drift and the test that should tie the two.

## Capabilities

### New Capabilities

None. T03 produces an evaluation document and research data and changes no behaviour, so `.openspec.yaml` sets `skip_specs: true` (project rule for document-only tasks). The acceptance signal is checked by the task list, not by spec scenarios.

### Modified Capabilities

None.

## Impact

- New files only: `docs/V3-MCP-EVALUATION.md` and `docs/v3/t03-mcp-eval/`.
- `docs/V3-IMPLEMENTATION-PLAN.md`: a T03 Resolution paragraph and the downstream edits the dispositions cause (T11, T13, T32, T41, T42), made when the user accepts the dispositions.
- Local machine: benchmark runs create worktrees of vibe-kanban in the session scratch area and spend model tokens (about 104 value runs on Haiku 4.5 and Sonnet 5, plus the parallel-load runs; estimate in design.md).
