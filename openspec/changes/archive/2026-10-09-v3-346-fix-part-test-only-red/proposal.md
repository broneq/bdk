## Why

Tracks #346.

A review finding "scenario X has no test" asks for a test of behaviour the code already has. `plan-fixes` turns it into a fix part like any other, `implement-part` writes the test, the red run passes because the behaviour is there, and the block reports `Status: blocker`, `Kind: other` ("cannot be seen red"). The execute lead retries it with the same result and the review stage ends blocked with the test uncommitted (observed in 1 of 3 `debug-fix` runs, 2026-10-09). "Acceptance tests first" (spec `bdk-execute-blocks`) is right for missing behaviour and wrong for a test that guards present behaviour, and nothing in a part tells the two apart.

## What Changes

- `plan-fixes` decides, when it traces a finding, whether the behaviour the finding asks a test for is already in the code. Such a scenario is listed under `## Acceptance scenarios` with the suffix ` (behaviour present)`, and the task's `Verified by:` says the new test passes at its first run.
- `implement-part` expects the test of a scenario marked ` (behaviour present)` to pass in the red run and records it as `; green at first run (behaviour present); green seen`. Every other acceptance test must still be seen red.
- `implement-part` stops with `Kind: plan-defect` (not `other`) when the part and the code disagree: an unmarked scenario's test passes before any code (the behaviour is present), or a marked scenario's test fails for a missing behaviour. A plan defect is not retried; the execute lead passes it to the part's author.
- New eval cases: `plan-fixes-present-behaviour` and `implement-part-present-behaviour` (blocks) and `auto-review-present-behaviour` (orchestrator, the acceptance signal: the fix part ends `Status: done` and committed), on a new shared fixture `tally-total-untested.sh`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-execute-blocks`: "Acceptance tests first" and "Implementer report" accept a test of a scenario the part marks ` (behaviour present)` green at its first run, and make a disagreement between the part and the code a plan defect.
- `bdk-auto-review`: "Fix parts" marks a scenario whose behaviour the code already has; "Eval cases of the review stage" holds the new cases.

## Impact

- `plugins/bdk/skills/plan-fixes/SKILL.md`, `plugins/bdk/skills/implement-part/SKILL.md`.
- `plugins/bdk/evals/fixtures/tally-total-untested.sh` (new), `plugins/bdk/evals/{plan-fixes-present-behaviour,implement-part-present-behaviour,auto-review-present-behaviour}/` (new), `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/stages.md` (what the implementer does with a test of present behaviour) and `docs/concepts/findings.md` (how a "no test" finding is planned); `docs/reference/` regenerated with `pnpm docs:reference`.
- Out of scope: `plan-draft` parts (a planned Change adds behaviour; nothing asks for the marker there), and `diagnose-bug`, which already forbids a task that only pins working behaviour.
