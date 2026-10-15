# Proposal

## Why

Tracks #426. In the #423 measurement (archived Change `v3-423-designer-planner-model`, design "Measurement") three of four first drafts of `design-draft-acceptance` answered AC-4 (a semicolon option) with a quoting rule on "the delimiter in use", so under `;` a label holding a comma is written bare, and one scenario says so. AC-3 ("A label holding a comma is quoted") has no condition, so that narrows it, and the scope log was empty. The verifier failed two of these drafts and passed the third, which listed AC-3 as answered. A `PASS` there lets an AC change reach the plan without the user, the failure #422 was built to stop.

## What Changes

- `verify-design` step 3.10 checks each AC as it stands against every requirement, scenario and decision that touches its subject, also those written for another AC, under every option, mode or input the deltas bring in; the design's own list of answered AC is a claim to check, not evidence. An AC kept under one option only is narrowed. The report holds one `Checked` line per AC with its quoted condition and what was read.
- New block case `verify-design-narrowed-ac`: the AC fixture of #422 with a design whose delta quotes only the delimiter in use and a scenario that writes `food, drinks` without quotes under `;`, an empty scope log and a design list naming AC-3 as answered. It grades `Verdict: FAIL` with a `Must address` item naming AC-3.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-blocks`: the AC check of `verify-design` covers an AC narrowed under one option, and the eval case for it.

## Out of scope

- A list the designer must fill (AC to scenario with the condition quoted): resolved against in the design (D1).
- The same check in `verify-plan`, `review-integration` and `spec-conformance`; none showed this miss.

## Impact

- `plugins/bdk/skills/verify-design/SKILL.md`, `plugins/bdk/evals/verify-design-narrowed-ac/`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/stages.md` (why a design fails verification) names an AC narrowed under one option. No diagram changes: no step, exit, file or agent of a flow changes. Reference regenerated with `pnpm docs:reference`.
- Paid runs: within the $5 Budget of #426 (design, "Measurement").
