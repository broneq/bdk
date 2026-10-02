## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T41 (Delivery item 5). Tracks #61.

A Change with a verified plan now stops at `/bdk:execute`, and that command resolves to nothing in v3: the graph has `execute-part` instances and the post-task step nodes, the orchestration layer of `v3-t41-orchestration` (#102) gives leads, `bdk agents wait`, continuation hooks and escalation on its model, but no stage skill drives them. The v2 `subagent-execute-plan` (662 lines) reads a v2 plan file the kernel does not know. `bdk next` hands one `execute-part` instance at a time, so nothing tells the orchestrator which parts can run together or whether a wave runs as a tree: T41-D3 placed that rule in the kernel and deferred it to this Change. The T40 execute measurement (docs/V3-EVAL-EXECUTE-AB.md, "For T41") recorded the failure a thin skill must avoid: a run stopped after part 01 although `bdk next` pointed at part 02.

## What Changes

- **New stage skill `execute`** (replaces the v2 `skills/subagent-execute-plan`, T02 disposition "redesign"), user-only, with `disable-model-invocation: true` and `disallowed-tools: Edit Write NotebookEdit` (P9):
  - Loops on `bdk next` until the Change leaves the execute stage: one `/bdk:execute` runs every ready part, and a pending gate item does not end the loop (T40 "For T41").
  - Runs each wave as `next` marks it. **Flat**: `main` starts the parts and runs their task tickets itself, following the swarm skill. **Tree**: `main` starts one lead per part on a `part-lead` ticket (T41-D11), in the background, and closes each part when its lead returns (`next.action: part-done`, then `bdk part done`).
  - Acts on every envelope status and every `next.action` (`commit`, `retry`, `narrow`, `escalate` on the escalation model, `parked`, `part-done`), resumes an agent once, and stops a wave on a critical `SendMessage` to `main`.
  - Finishes the execute-stage nodes after the parts: `bdk done spec-delta`, and a post-task step whose evidence is missing or stale after its part closed, in a `verify-fix` ticket of that part.
  - Ends with a report from kernel output: parts done, tasks committed, open findings and blockers, the `review: true` entries, and `/bdk:cr`, which the user types.
- **Kernel, the wave in `bdk next`** (T41-D3): when the next node is an `execute-part` instance, `next` also returns `wave`: every ready `execute-part` instance with whether its part is started, its open tickets and its `mode`, `tree` or `flat`. A part not started runs as a tree when the effective profile is `large`, `execution.tree.enabled` is true and the ready parts not started number at least `execution.tree.min-parts`; a started part keeps the mode of its open tickets. The rule, its setting and its tests land here.
- **New settings module `execution.tree`** (consumer `graph`): `enabled` (default `true`) and `min-parts` (integer 2 to 15, default 2).
- **Instruction of `execute-part`**: names the mode and `bdk next` as the step after `bdk part done`, so the orchestrator turns to the next part instead of ending (T40 "For T41").
- **Removed** (decision 1): the v2 `skills/subagent-execute-plan/`. Its `references/return-contract.md`, still read by the v2 agents `implementer` and `fixer` through the meta-skill `bdk-implementer-return-contract` until T42 removes them, moves into that meta-skill. README, the user guide and the generated agent table name `/bdk:execute`.
- **No Workflow strategy in 3.0** (decision 2): `features.workflow` is never registered; the tree of leads covers parallel parts.
- **`ctx skill` manifest**: `execute` gets the `Concurrency` part and the `decision` fragment.
- **Evals** (decision 3): case file `execute.yaml` in the `stages` suite with `flat` (a `tiny` Change seeded with the T40 audit CSV task, two dependent parts), `tree` (a `large` Change seeded with two independent parts) and `not-ready` (a plan not yet done); a case may name a `seed` function, since a seeded Change needs files and kernel calls a shell line does not express well. This Change runs only `--probe`.
- **User documentation**: `reference/skills.md`, `reference/artifacts.md`, the workflow and concept pages that name `/bdk:subagent-execute-plan`, README's skill table and pipeline section.

## Capabilities

### New Capabilities

None. `stage-skills` exists and gains the skill.

### Modified Capabilities

- `stage-skills`: requirements for `execute` (the loop over `next`, flat and tree waves, envelopes and next actions, the closing report) and the removal of the v2 executor.
- `kernel-cli/graph`: `bdk next` returns the `wave` with each part's mode.
- `kernel-settings`: the `execution.tree` keys.
- `role-contracts`: the swarm skill reads the tree or flat mode from `wave` in `bdk next`.
- `skill-evals`: a stage case may name a seed; the `execute` cases.

`kernel-loops` needs no delta: the `part-lead` loop and `part-done` exist since #102. `kernel-pipeline` keeps its kinds and graph variants; the `execute-part` template text is a prompt value, not a requirement.

## Impact

- New: `skills/stages/execute/SKILL.md`, `evals/suites/stages/cases/execute.yaml`, a seed module of the `stages` suite, the `execution.tree` config module in `kernel/src/graph/`.
- Removed: `skills/subagent-execute-plan/` and its `skill-check` baseline entries.
- Changed: `kernel/src/graph/use-cases/next.ts` and its output schema (`schema/cli/output/next.json`, regenerated), `pipeline/execute-part.md`, `kernel/src/ctx/use-cases/manifest.ts`, `skills/swarm/SKILL.md`, `skills/bdk-implementer-return-contract/`, `evals/suites/stages/` (cases, suite, hooks), `dist/bdk.mjs` (rebuilt), `STARTUP_INSTRUCTIONS.md` (regenerated), README, `docs/guide/`, `docs/V3-IMPLEMENTATION-PLAN.md` (T41 scope: no Workflow).
- Out of scope: `close`, `run` and how `run` passes gates (`v3-t41-close-run`); `cr` on the swarm and the review stage (T42); the v2 agents `implementer` and `fixer` (T42); a configurable plan size limit (T44, #106); the `--skip-verify` flag of `/bdk:execute`, which the kernel records and no graph rule reads yet.

## Decisions taken with the user (2026-10-01)

1. **Remove the v2 `subagent-execute-plan` now**, as `create-plan` and `verify-plan` went with `v3-t41-plan`. Rejected: keeping it until T42 (two ways to execute a plan, one of which does not read the kernel's plan parts).
2. **No Workflow strategy in 3.0.** The tree of leads (T41-D1, D2) runs independent parts in parallel; Workflow depends on a paid plan, enforces budgets outside BDK and starts many agents at once (design Q4 already rejected it as the core). Rejected: `features.workflow` as a third wave strategy. A later task can add it with its own measurement.
3. **Two live eval cases, flat and tree.** The tree case is the first live run of the orchestration layer before T50. Rejected: flat only, with the tree covered by kernel E2E tests (a lead would never run against a real host before the release).
