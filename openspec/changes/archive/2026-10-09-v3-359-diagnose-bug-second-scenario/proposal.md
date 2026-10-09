# Proposal

## Why

Tracks #359. In 1 of 9 runs of the eval case `diagnose-bug-reproduced` (2026-10-09, Claude Code 2.1.292, measured for #341) `diagnose-bug` wrote the fix part with two acceptance scenarios: the reproduction ("Total after an add") and a second one for a related defect its diagnosis found, ledgers the bug had already written with text amounts ("Ledger with amounts recorded as text"), with a second task for it. The skill text says "The only acceptance scenario is the reproduction scenario" but gives the model no place for a related defect, so a careful diagnosis turns it into scope. The grader `one-acceptance-scenario` (#262) failed.

## What Changes

- `diagnose-bug` names each related defect its diagnosis finds (another bug, or data the bug already wrote that the fix of the cause does not repair) instead of fixing it: one `Related:` line each in `debug/diagnosis.md`, a "Related, not fixed" entry under Risks in `design.md`, and in its reply. It never becomes a second acceptance scenario, a task, a spec scenario or a fix decision of the Change.
- `/bdk:debug` passes the related defects on: the fix gate names them, and `debug/result.md` lists them under `## Bug`, so the user can open a Change for each.
- A new eval case `diagnose-bug-related-defect` provokes the related defect (the report says the user's ledgers already hold text amounts) and grades one acceptance scenario and a `Related:` line.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-debug`: Requirement "Fix Change" states where a related defect goes; Requirement "Result" lists related defects in `debug/result.md`; Requirement "Gate" names them at the fix gate.

## Impact

- `plugins/bdk/skills/diagnose-bug/SKILL.md`, `plugins/bdk/skills/debug/SKILL.md`.
- `plugins/bdk/evals/diagnose-bug-related-defect/` (new case), `plugins/bdk/evals/README.md` (case list, if it names the debug cases).
- User docs: `docs/concepts/orchestrators.md` (`/bdk:debug` section: prose on related defects; the diagram's diagnose box names them) and `docs/guide/workflow.md` (the bug entry). `docs/reference/` regenerated.
- Out of scope: the host stall of eval runs (#341, done).
