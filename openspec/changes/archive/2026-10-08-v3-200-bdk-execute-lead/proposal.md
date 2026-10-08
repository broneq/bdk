# Proposal

## Why

Tracks #200.

The plan parts of a Change are built by the execute blocks `implement-part` and `conform-part` (#192), one part at a time. Nothing yet runs a whole plan: waves from `depends-on`, parts in parallel, worktrees, commits, merge-back, retries and model escalation, and the part state that `bdk run status` and resume read. Draft 1 did this in a kernel (`bdk next`, tickets, `dispatch build`, `part start|done`) and spent most of its execute time in that bookkeeping ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), "Speed"). The architecture (`docs/design/2026-10-07-v3-architecture.md`, D1 hybrid A+C, D3-0, "Flows / Execute", "Run state, run artifacts and resume") puts this stage into one `bdk:lead` agent started by a thin `/bdk:execute`; D8 of `docs/design/2026-10-07-v3-skills-decisions.md` fixes the wave size limit `execution.max-parallel`.

## What Changes

- New thin orchestrator `/bdk:execute` (`plugins/bdk/skills/execute/`): checks the configuration and the Change, starts one `bdk:lead` agent with the lead skill, in the background or the foreground as `execution.lead` says, relays the lead's result, and passes a blocker on to the user (or stops by `policy.questions`), continuing the lead with `SendMessage` on a retry.
- New lead skill `execute-waves` (`plugins/bdk/skills/execute-waves/`) on a new agent `bdk:lead` (`plugins/bdk/agents/lead.md`, sonnet): takes the waves from `bdk plan check --json`; puts the Change on its own branch; runs a `shared` part in the main checkout and each `worktree` part in its own git worktree under the run directory; starts at most `execution.max-parallel` part agents at once as foreground `Agent` calls, a larger wave in batches in part order; runs `implement-part` then `conform-part` per part with the absolute run directory; retries a part within `policy.budgets.part-attempts`, the last attempt on `policy.escalation.model`; commits each part; merges the worktrees into the Change branch in part order after the wave; has a merge conflict resolved by the implementer; writes `state.json` (the only writer) and `execute/result.md`.
- New block `resolve-conflict` (`plugins/bdk/skills/resolve-conflict/`) on `bdk:implementer`: in a merge stopped on conflicts, edits each conflicted file so it keeps what both sides meant, runs the checks of the parts involved, and writes `execute/merge-NN.md`. It never stages or commits; the lead does.
- `implement-part` and `conform-part` take `--workdir <path>`: a subagent cannot change its working directory (host fact probed in this Change), so a worktree part's agent works on absolute paths under the worktree and runs each command in it. `implement-part` also reads a failed conform report on a retry.
- New configuration key `execution.max-parallel` (integer, at least 1), default 10, set from the concurrency probe of this Change (D8).
- Eval: a shared fixture with two `worktree` parts in one wave that both change one file, the orchestrator cases `execute-wave-conflict` (both parts built, the merge conflict resolved, `state.json` done) and `execute-plan-defect` (the blocker reaches the main thread, no retry), and the block case `resolve-conflict-two-functions`.

## Capabilities

### New Capabilities
- `bdk-execute`: the `/bdk:execute` orchestrator, the `execute-waves` lead skill and the `bdk:lead` agent - waves, batches, branch and worktrees, retries and escalation, commits and merge-back, `state.json`, the result, blockers and resume.

### Modified Capabilities
- `bdk-execute-blocks`: `--workdir` for both blocks; `implement-part` reads a failed conform report on a retry; the new block `resolve-conflict` on `bdk:implementer`.
- `bdk-cli/config`: the key `execution.max-parallel`.

## Impact

- New: `plugins/bdk/skills/execute/`, `plugins/bdk/skills/execute-waves/`, `plugins/bdk/skills/resolve-conflict/`, `plugins/bdk/agents/lead.md`.
- Changed: `plugins/bdk/skills/implement-part/`, `plugins/bdk/skills/conform-part/`, `plugins/bdk/agents/implementer.md`, `plugins/bdk/agents/conformer.md`; `plugins/bdk/src/config/domain/settings.ts` and its tests.
- `plugins/bdk/evals/`: one fixture, three cases, README grants and run commands.
- `CLAUDE.md` "Current state"; `docs/design/2026-10-07-v3-architecture.md` "What We Did NOT Decide" (the two host probes answered).
- No other CLI change: `bdk plan check --json` gives the waves, `bdk check run` the checks, `bdk run status` reads `state.json` as spec `bdk-cli/run` defines it.
- Out of scope: review rounds and the fixes of review findings through execute (#201); the autopilot `/bdk:run` (#203); `plan-draft`, `verify-plan` and `/bdk:plan` (#191, #199, merged); the speed measurement of execute on the B1-sized fixture (#243 delivered the fixture; the measurement is a follow-up).
