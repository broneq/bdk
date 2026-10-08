# Proposal

## Why

Tracks #199.

The plan blocks exist (#191): `plan-draft` writes the plan parts `plan/parts/NN.md` and checks them with `bdk plan check` (#185), `verify-plan` checks them against the code in a `bdk:verifier` agent and writes `.bdk/runs/<change>/plan/verify-N.md`. Nothing composes them, so a user (and later `/bdk:run`) runs two commands, reads each verdict, decides whether to fix and verify again, and decides when to stop. The architecture names the composer: `/bdk:plan`, an orchestrator in the main thread that runs `plan-draft`, `bdk plan check` and a `verify-plan` loop to PASS or to `policy.budgets.verifier` ("Catalog", Orchestrators; "Flows / Plan"; ADR-0003 D1).

## What Changes

- New skill `/bdk:plan` in `plugins/bdk/skills/plan/`: an orchestrator that only composes. It drafts with `plan-draft` in the main thread, runs `bdk plan check` on the parts before every verification, verifies with `verify-plan` on `bdk:verifier`, and on `Verdict: FAIL` runs `plan-draft` to fix and verifies again with the same verifier, until a report passes or `policy.budgets.verifier` passes are used.
- Resume from files: the skill starts at the first missing or open step (no parts, no report, a failed last report), matching row 3 of `bdk run status`; a passed plan runs nothing.
- Guards on the input: a design whose last design report failed is not planned, a check `plan-draft` cannot clear stops the run before an opus pass, and a gap of the design that `plan-draft` names stops the run before verification.
- Orchestrator eval cases (`tags: [orchestrator]`) with `tool_order` and `file_exists` graders (issue "Acceptance signal").

## Capabilities

### New Capabilities

- `bdk-plan`: the `/bdk:plan` orchestrator - configuration and input check, resume from run files, the draft / check / verify loop with its budget, the stops, the report, and its eval cases.

### Modified Capabilities

None. `policy.budgets.verifier` exists already (#198) and its row in spec `bdk-cli/config` names the plan orchestrator as a consumer.

## Out of scope

- A plan gate: `policy.gates` has `design` and `review` only (architecture "Configuration and extension points"); the plan goes to execute when it passes.
- `/bdk:execute` (#200) and `/bdk:run` (#203).
- Measuring `plan-draft` on a B1-sized Change (#242, #243).
- Changes to `plan-draft`, `verify-plan` and `bdk plan check`.
- Block replacement through `steps.plan`: an open point of the architecture ("What we did NOT decide").

## Impact

- `plugins/bdk/skills/plan/SKILL.md` (new).
- `plugins/bdk/evals/plan-*` orchestrator cases, `plugins/bdk/evals/README.md`.
- `CLAUDE.md` "Current state".
