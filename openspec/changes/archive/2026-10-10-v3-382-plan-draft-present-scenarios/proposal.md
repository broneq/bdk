## Why

Tracks #382.

A MODIFIED requirement of a spec delta carries all its scenarios, also the unchanged ones that the code already satisfies, because OpenSpec replaces the whole requirement. `plan-draft` assigns every scenario to a part but has no rule for the suffix ` (behaviour present)` that `implement-part` (step 4, #346) and `plan-fixes` know. The implementer writes a test for each listed scenario, expects it red, sees it pass, and may stop the part as `Kind: plan-defect`.

#260 measured it (Change `v3-260-measure-run-multi-change-queue`, design "Measurement"): the delta of issue "Categories on entries" on the `ledger` CLI MODIFIES four requirements and holds 17 scenarios. In the queue run part 01 listed all 17 unmarked, `verify-plan` passed it, and the implementer saw 7 pass at once and stopped with `plan-defect`, which stopped the whole unattended queue at execute. The same issue run alone passed, since a more lenient implementer run let 5 unmarked present scenarios through. The outcome depended on how strict one implementer run is, not on the plan.

## What Changes

- `plan-draft` (step 2 and step 4): for each scenario, trace its WHEN through the code to the output; a scenario whose THEN the code already gives, before any task of the plan runs, is listed in `## Acceptance scenarios` with the suffix ` (behaviour present)`, and its task's `Verified by:` ends `; it passes at its first run, the behaviour is present`. A scenario the code does not satisfy, or satisfies in part, is not marked. A part holding only present scenarios is allowed only when no other part owns the code or the test file of those scenarios (design D2).
- `verify-plan` (step 3, `Must address`): every scenario the current code already satisfies carries the suffix, and none that the code does not satisfy does.
- Two block cases on a Change that MODIFIES existing requirements (fixture `tally-modified.sh`): `plan-draft-present-scenarios` and `verify-plan-present-scenarios`, with a with/without measurement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-plan-blocks`: `plan-draft` marks the scenarios whose behaviour is present; `verify-plan` fails a part that leaves one unmarked or marks one that is not present; the two eval cases.

## Out of scope

- `implement-part`, `plan-fixes` and `conform-part`: they already know the suffix.
- A CLI helper that finds present scenarios: no measurement shows one is needed (CLAUDE.md, "Building skills (v3)").
- Running the #260 queue again end to end: it is the acceptance measurement of #260's follow-up, recorded here only through the block cases (design "Results").

## Impact

- New: `plugins/bdk/evals/fixtures/tally-modified.sh`, `plugins/bdk/evals/plan-draft-present-scenarios/`, `plugins/bdk/evals/verify-plan-present-scenarios/`.
- Changed: `plugins/bdk/skills/plan-draft/SKILL.md`, `plugins/bdk/skills/verify-plan/SKILL.md`, `plugins/bdk/evals/README.md`.
- User docs: the Guide and Concepts pages that describe what `/bdk:plan-draft` and `/bdk:verify-plan` write and check (`docs/concepts/stages.md`, `docs/concepts/orchestrators.md`) say that the plan marks present scenarios; the Docs task group updates them and regenerates the Reference.
- No change to `package.json`, the lockfile or the CLI.
