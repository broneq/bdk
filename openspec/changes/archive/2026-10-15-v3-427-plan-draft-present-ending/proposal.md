# Proposal

## Why

Tracks #427. In the #423 measurement (archived Change `v3-423-designer-planner-model`, design "Measurement") `plan-draft-household-book` marked the present scenarios on both `sonnet` and `opus`, but tasks 3, 4 and 5 of part 02 named them on `Verified by:` lines that end with a test file or `npm test`, hold the ending in the middle, or share the line with scenarios that are not present. The `opus` verifier failed both plans for it, so every B1-sized plan pays a fix round for a format rule. The rule exists (spec `bdk-plan-blocks`, "plan-draft marks the scenarios whose behaviour is present", #382) and holds on the small case; it breaks when one task tests several scenarios, some present and some not.

## What Changes

- `bdk plan check` gets a check `present-scenario`: every scenario a part marks ` (behaviour present)` needs a `Verified by:` line in that part that names it and ends `; it passes at its first run, the behaviour is present`, and a line with that ending names no unmarked scenario of the part. It does not block waves; `execute-waves` notes it and goes on, as for the size checks.
- `plan-draft` gives each present scenario a `Verified by:` line of its own; a task that tests several scenarios holds several `Verified by:` lines. The worked part shows one such task. The part instruction of the shipped BDK schema says the same.
- `plan-draft-household-book` gets the grader `present-endings`: the ending on the four scenarios both measured plans marked present. Its `plan-check-clean` grader now also covers the new check.
- The block case `verify-plan-present-scenarios` keeps its two seeded wrong markers but now passes `bdk plan check`, so its verdict still comes from the markers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/plan`: the `present-scenario` check and its place in the problem order.
- `bdk-plan-blocks`: one `Verified by:` line per present scenario, checked by `bdk plan check`.
- `bdk-openspec-schema`: a task may hold several `Verified by:` lines.
- `skill-evals`: the `present-endings` grader of `plan-draft-household-book`.

## Resolved in the spec

- Skill text only, or a `bdk plan check` problem: both (design D1). A format rule is checked deterministically, so `plan-draft` sees the miss in its own check step and fixes it before the verifier runs; the skill text says how to write the line so the check rarely fires.

## Out of scope

- The wrong marker on `Unknown version` in the `sonnet` run of #423 (a tracing miss, not a format one).
- #426 (`verify-design` passes a narrowed AC).

## Impact

- `plugins/bdk/src/plan/domain/` (`part.ts`, `check.ts`) and their tests; `plugins/bdk/skills/plan-draft/` (SKILL.md, `references/part-example.md`); `plugins/bdk/skills/execute-waves/SKILL.md`; `plugins/bdk/openspec/schemas/bdk/schema.yaml`; `plugins/bdk/evals/plan-draft-household-book/graders/present-endings.md`, `plugins/bdk/evals/verify-plan-present-scenarios/parts/01.md`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/stages.md` ("When you review a plan": the marker and its `Verified by:` line); the Reference regenerated (`docs/reference/bdk/cli.md`, the problems of `bdk plan check`).
- Paid runs: `plan-draft-household-book` 3 runs on `sonnet`, `--ablation none`: $2.90 of the issue's Budget of $5.
