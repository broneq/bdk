# Proposal

## Why

Tracks #201.

The review blocks (`review-group`, `review-integration`, `judge`, #193), the E2E block (`e2e-check`, #194), `triage` (#195) and the execute stage (`/bdk:execute` with its `bdk:lead`, #200) exist, but nothing runs a review round or repeats rounds until no blocker is left. Draft 1 ran full review rounds every time: B1 spent rounds 3 and 4 on one or two minor entries ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), "Speed"). The architecture (`docs/design/2026-10-07-v3-architecture.md`, "Catalog", "Flows / Autopilot", "Flows / Review round", "Run state, run artifacts and resume") puts one round into the lead skill `review-round` on `bdk:lead`, and the rounds, triage and fixes into the main-thread orchestrator `/bdk:auto-review`; a later round covers only the scope of the fixes, and E2E runs in every round. D2 and D3 of `docs/design/2026-10-07-v3-skills-decisions.md` fix the levels and what auto mode decides per level, `should-fix` within `policy.budgets.review-rounds`.

## What Changes

- New lead skill `review-round` (`plugins/bdk/skills/review-round/`) on `bdk:lead`: records the round's scope and groups with `bdk git groups --rounds --plan --record` (a later round starts after the last finished round, so it covers only the fix commits); starts one `bdk:reviewer` per group and one `bdk:e2e-tester` in parallel while it runs `bdk check run --round`; then `bdk:integration-reviewer`; then `bdk:judge`, which writes `report.md`; writes `round.md` and returns the report's counts line.
- New block `plan-fixes` (`plugins/bdk/skills/plan-fixes/`, main thread): turns the `fix` decisions of a judged and triaged round into fix parts `review/round-N/fixes/parts/NN.md` in the plan part format (ids continue after the plan's and the earlier rounds' parts), checks them with `bdk plan check`, and writes `fixes/index.md` naming each finding's part, or why a finding cannot be planned as a fix.
- New orchestrator `/bdk:auto-review` (`plugins/bdk/skills/auto-review/`, main thread): derives where it stands from the round files; starts `review-round` in a `bdk:lead` (background or foreground per `execution.lead`); runs `triage`; when findings are to be fixed and the budget allows another round, runs `plan-fixes` and the fix pass through the execute lead, then the next round on the fix scope; stops when a round leaves nothing to fix, when the budget is spent, or on a blocker; writes `review/result.md`.
- `execute-waves`, `implement-part`, `conform-part` and `resolve-conflict` take `--parts <dir>`: the fix pass builds the fix parts of a round with the same lead and blocks; the fix pass keeps its own `state.json` and `result.md` in the directory that holds the parts directory (`review/round-N/fixes/`), so the plan's part state and `bdk run status` stay as they are.
- `review-group` and `review-integration` read a fix part as a group's contract and check that each fixed finding's failure scenario no longer holds; in a round anchored on an earlier round, `review-integration` checks only the scenarios and contracts the fix scope reaches.
- `triage` takes `--last-round`: in the last round the budget allows, a `should-fix` finding is deferred in auto mode and recommended `defer` in manual mode (D3: `should-fix` is fixed only within `policy.budgets.review-rounds`).
- `bdk:lead` names `review-round` among its stage skills.
- Eval: block case `plan-fixes-judged-round`, triage case `triage-last-round`, orchestrator cases `auto-review-first-round` (one round end to end, manual triage asks) and `auto-review-fix-round` (triage, fix pass, a second round that covers only the fix scope).

## Capabilities

### New Capabilities
- `bdk-auto-review`: the `/bdk:auto-review` orchestrator, the `review-round` lead skill and the `plan-fixes` block - the round's scope and parallel reviews, checks and E2E, integration and judge; triage, fix parts, the fix pass through execute, rounds on the fix scope, the round budget, the result and resume.

### Modified Capabilities
- `bdk-execute`: `execute-waves` builds the parts of another directory (`--parts`), with that directory's own state and result.
- `bdk-execute-blocks`: `implement-part`, `conform-part` and `resolve-conflict` read the part from `--parts <dir>` when given.
- `review-blocks`: fix parts as a group's contract, fixed findings checked again, and the integration review of a later round limited to the fix scope.
- `triage-block`: `--last-round` and the `should-fix` decision when the round budget is spent.

## Impact

- New: `plugins/bdk/skills/auto-review/`, `plugins/bdk/skills/review-round/`, `plugins/bdk/skills/plan-fixes/`.
- Changed: `plugins/bdk/skills/execute-waves/`, `implement-part/`, `conform-part/`, `review-group/`, `review-integration/`, `triage/`; `plugins/bdk/agents/lead.md`.
- `plugins/bdk/evals/`: four cases, README grants and run commands.
- `CLAUDE.md` "Current state".
- No CLI change: `bdk git groups --rounds --record` gives the fix scope, `bdk check run --round` the red checks as findings, `bdk findings` the log, levels, decisions and report, `bdk plan check` the fix parts, `bdk run status` the resume rows 5 to 8 as spec `bdk-cli/run` defines them.
- Out of scope: `/bdk:pr-review` (#205), `/bdk:run` (#203), `/bdk:debug` and its fix-scope review, measuring review time on the B1-sized fixture (follow-up), a workflow version of `review-round` (architecture "What We Did NOT Decide").
