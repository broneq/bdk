## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T41 (Delivery item 4). Tracks #61.

A Change that passes `gate:design` now stops at `/bdk:plan`, and that command resolves to nothing: the v3 graph has a `plan` node of kind `plan-part` and a `plan-verify` verdict node, but no skill writes plan parts or runs the verifier. The v2 `create-plan` writes a single file under `.bdk/plans/` that the kernel does not read, and the v2 `verify-plan` holds the name the v3 skill needs. A probe on 2026-10-01 (scratch repository, current bundle) also showed three gaps in the kernel side of the stage: the `plan` node's instruction carries no `BDK-PL` rules although T41 asks for a tick list of them; the `plan-verify` package reads only the plan parts, so the verifier cannot tell whether the plan covers the design; and the verdict hash ignores the spec deltas that `done plan` already requires. This Change delivers the v3 `plan` and `verify-plan` stage skills and closes those gaps.

## What Changes

- **New stage skill `plan`** (replaces the v2 `skills/create-plan`, T02 disposition "redesign"), user-only (`disable-model-invocation: true`):
  - Reads `bdk next`, grounds itself in the design, the ledger and the code, and writes the plan parts `next` names, at most 8 tasks and 8 KB each (S1), with the P6 fields.
  - A task is a contract, not code (decision 1): the goal, exact signatures and formats that other tasks or parts consume, `Files:`, `Depends on:`, `Stop rule:` where a worker could widen the task. No fenced implementation blocks.
  - Test cases are the core of every task (decision 2): each names an input and the expected observable result; every behaviour the task text states has a case, boundaries and error paths included.
  - Writes the spec delta of each capability a part names in `spec-impact`, before `bdk done plan`, since the part check requires it.
  - Ticks the `BDK-PL` rules by id before `bdk done plan`.
  - Answers the live `question` entries that block execution, asking the user only what the design and the code do not settle, and records each answer as a `decision`.
  - Plans `bug` and `tiny` Changes, which have no design stage, from the intent and the code.
  - Runs `/bdk:verify-plan` and corrects the plan itself in a loop until the verdict passes or the attempt budget ends (decision 6). It asks the user only about a blocker that needs a decision the design does not hold, in one question. It ends with a report (parts, waves, corrections, findings) naming `/bdk:execute`; `--review` stops for one review before that report (decision 7).
- **New stage skill `verify-plan`** (replaces the v2 `skills/verify-plan`): one verifier round in the main thread, like `verify-design` (v3-t41-design D3): `attempt open verifier plan-verify`, `dispatch build plan-verify verifier`, `Agent` with `bdk:reader`, `attempt close`, `done plan-verify`. One verifier reads every part and the design (decision 4).
- **Kernel, plan stage** (no new kind):
  - The `plan` node's `rules` gain `plan`, so its instruction carries `BDK-PL-1..3`.
  - `plan-verify` requires the design-stage documents (`design`, `design-index`, `architecture`) besides `plan`, so its package names them and a design change makes the verdict stale through the `fresh` check.
  - `plan-verify` hashes the spec deltas besides the plan parts: an edited delta needs a new verdict.
  - The instruction templates `pipeline/plan-part.md` and `pipeline/plan-verify.md` name the task shape and `/bdk:verify-plan`.
- **`verifier` role contract**: verifies every part its package names, together; adds the checks a contract-style plan needs (concrete test cases covering each stated behaviour, the design's requirements and decisions covered, declared dependencies between parts, one file not edited by two parts of the same wave).
- **Removed**: the v2 `skills/create-plan/` and `skills/verify-plan/` (decision 5); `/bdk:plan` and `/bdk:verify-plan` each resolve to one skill. The v2 agent `plan-verifier` stays until T42, as `design-verifier` did. `skills/debug` hands a large fix to the user's `/bdk:change` and `/bdk:plan` instead of invoking `/bdk:create-plan`.
- **`ctx skill` manifest**: `plan` gets the plan rules, engineering judgment, the test-quality rules, language rules, project rules and the `decision` fragment; `verify-plan` an empty entry for its `BDK STOP` line; the `create-plan` entry goes.
- **Evals**: case files `plan.yaml` and `verify-plan.yaml` in the `stages` suite; this Change runs only `--probe`.
- **User documentation**: `reference/skills.md`, `reference/artifacts.md`, the workflow and concept pages that name `/bdk:create-plan` or `/bdk:verify-plan`, README's skill table.

## Capabilities

### New Capabilities

None. `stage-skills` exists and gains the two skills.

### Modified Capabilities

- `stage-skills`: requirements for `plan` (writing contract-style parts with concrete test cases, spec deltas, the self-correcting verification loop, the closing report and `--review`) and `verify-plan`.
- `kernel-pipeline`: `plan-verify` hashes the spec deltas; the plan-stage nodes (rules of `plan`, requirements of `plan-verify`) and their instructions.
- `role-contracts`: the `verifier` contract verifies the whole plan and checks test cases, design coverage and dependencies between parts.

`skill-evals` needs no delta: its `stages` requirement already covers every stage skill with a case file. `kernel-state` keeps the plan part grammar unchanged.

## Impact

- New: `skills/stages/plan/` (`SKILL.md`, `references/task-shape.md` with one worked part), `skills/stages/verify-plan/SKILL.md`, `evals/suites/stages/cases/plan.yaml` and `verify-plan.yaml`.
- Removed: `skills/create-plan/`, `skills/verify-plan/` (v2), their `skill-check` baseline entries.
- Changed: `pipeline/pipeline.yaml`, `pipeline/plan-part.md`, `pipeline/plan-verify.md`, `PlanVerifyKind` in `kernel/src/graph/domain/kinds/verdicts.ts`, `skills/roles/verifier/SKILL.md`, `kernel/src/ctx/use-cases/manifest.ts`, `evals/suites/stages/suite.ts`, `skills/debug/SKILL.md`, `dist/bdk.mjs` (rebuilt), README, `docs/guide/`.
- The v2 executor `subagent-execute-plan` loses its input (a v2 plan and its `.bdk/verify-plan/` stamp) until `v3-t41-execute` replaces it; nothing in v3 calls it.
- Out of scope: `execute` and the wave strategy (`v3-t41-execute`); `close`, `run` and how `run` passes gates (`v3-t41-close-run`); a per-task model tier in the plan grammar (candidate for T43, after a measurement on a harder task); the v2 agent `plan-verifier` and the `STARTUP_INSTRUCTIONS.md` agent table (T42).

## Decisions taken with the user (2026-10-01)

Lavish pages `.lavish/t41-plan-questions-r1.html` (analysis) and `.lavish/t41-plan-questions.html` (summary).

1. **A task is a contract, not code.** Goal, exact signatures and formats other tasks consume, `Files:`, test cases. Rejected: full implementation code as in v2 (two to three tasks per 8 KB part, code that goes stale when an earlier task differs, tests written to fit given code), and code only where words do not fix one result (a judgment the planner gets wrong, little to gain once test cases are concrete).
2. **Test cases are the core of the plan.** Each case names an input and the expected observable result; every stated behaviour has one; a behaviour without a case is a verifier blocker.
3. **The implementer stays on the balanced tier with escalation.** The `execute-ab` measurement (2026-09-29) ran a contract-style plan with the worker on the balanced tier at `medium` effort: acceptance 1 and completeness 1 in five of five runs. A per-task tier in the plan is left for T43, after a measurement on a harder task. The limits of 8 KB and 8 tasks per part stay: 8 KB is about 2 000 tokens; the limit bounds the lead's package (12 KB) and the scope of a part, not the context.
4. **One verifier per round over the whole plan.** It sees contracts between parts, a file edited by two parts and missing `depends-on`. Rejected: one verifier per part in parallel (no view across parts, several tickets per node, a kernel change).
5. **Remove both v2 skills now.** Rejected: keeping `create-plan` until `execute` lands (two planning skills with different outputs, and a closing line pointing at a `verify-plan` that no longer takes a file).
6. **`plan` corrects itself and asks only for decisions.** The user wants as few actions as possible: the skill fixes every blocker that does not change a decision of the design, verifies again within the budget, and asks only about a blocker that needs a product decision, or when the budget is used up.
7. **Report by default, `--review` on request.** `/bdk:plan` ends with a report and `/bdk:execute`, which the user types; `/bdk:plan --review` stops for one review of the verified plan first. Rejected: a review on every run (one more action per plan) and no review option at all.
