# Proposal

## Why

Tracks #430. In the #427 measurement (archived Change `v3-427-plan-draft-present-ending`, design "Measurement") `plan-draft-household-book` scored 0.86 in 1 of 3 runs on `sonnet`: its plan was clean with 4 waves, because part 09 (reports) depended on part 06 for `budgetStatus`, a pure function of the budget feature that the fixture's design D9 reuses. The #423 plans and the other two #427 runs put that module into the first part and got 3 waves. In all three #427 runs the foundation part also ended at 8143, 8160 and 8184 of the 8192 bytes of `plan.part.max-bytes` (the #423 `sonnet` plan at 8164), which leaves the verifier's fixes no room.

`plan-draft` step 3 already says to put a contract several parts need first, but a "contract" reads as a type or a signature, not as a function body a feature owns, and nothing says what an early part should leave out or how full a part may be.

## What Changes

- `plan-draft` step 3: a function that a part other than its feature's own uses is a contract too, and goes into a wave-1 part; before it writes the parts, the planner walks the longest `depends-on` chain and moves such a function forward when an edge exists only for it. What no other part uses (a command only the user calls, with its tests) leaves the early part for a later wave, when it does not lengthen the longest chain. Each part keeps room: at most seven eighths of `plan.part.max-bytes` in the final check, so a fix round does not split parts.
- Spec `bdk-plan-blocks`, "Plan shape for short waves", says the same.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-plan-blocks`: where a shared function and leaf work go, and the room a part keeps.

## Resolved in the spec

- Skill text for where a shared module goes, a changed part limit default, or neither: skill text (design D1, D2). The default `plan.part.max-bytes` stays 8192: a larger limit only moves the edge, and the room is a planner choice, not a limit the CLI enforces.

## Out of scope

- Any change to `bdk plan check` (it already prints each part's bytes against the limit).

## Impact

- `plugins/bdk/skills/plan-draft/SKILL.md` (step 3), `plugins/bdk/evals/README.md` (the recorded result).
- User docs: `docs/concepts/stages.md` ("How a plan is cut": shared functions early, room in each part).
- Paid runs: `plan-draft-household-book` 3 runs on `sonnet`, `--ablation none`: $2.45 of the issue's Budget of $5 (design "Measurement").
