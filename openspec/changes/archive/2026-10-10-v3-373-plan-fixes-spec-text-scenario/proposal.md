## Why

Tracks #373.

In the #368 measurement (uncorrected B1-sized Change `add-household-book`), round 1's `spec-conformance` finding f-4774f0e74a95 (the shared amount and date errors documented for `ledger add` only) was decided `fix`. `plan-fixes` wrote fix part 09 task 2: "add to the `ledger` delta, under `## ADDED Requirements` ... a Requirement: Shared argument checks ... Add no scenario". The implementer did so, the conformer passed it, and `openspec validate add-household-book --strict` then failed with `ADDED "Shared argument checks" must include at least one scenario`. Close refused the archive and the run stopped after 35 minutes on a defect its own fix pass wrote.

The cause is the `Verified by:` rule of `plan-fixes` for a fix of spec text only: "the task adds no acceptance scenario of its own" means the part's `## Acceptance scenarios` list, but it reads as "the delta gets no scenario". Nothing between the plan and close checked that the delta stays valid OpenSpec.

## What Changes

- `plan-fixes`: a spec-text task that adds a requirement names at least one `#### Scenario:` for it, with the WHEN and the THEN the code gives; the rule that the part lists no acceptance scenario is reworded so it cannot be read as "the delta gets no scenario". The task's `Verified by:` names `openspec validate <change> --strict` next to the next round's spec check.
- `implement-part`: after the tasks, a part that changed a spec delta of the Change runs `openspec validate <change> --strict` and fixes what it reports in the part's files, three runs in all, like the part checks; the result is a line under `## Checks`.
- `conform-part`: a part whose diff changes a spec delta runs `openspec validate <change> --strict`; an error on a delta of the part is a `Left` item naming the task, so the verdict is `FAIL` and the lead retries the part.
- The limits of both execute blocks allow that one OpenSpec command next to `bdk check run`; it is local, reads files only and spends nothing.
- Eval cases: `plan-fixes-spec-delta` gets graders for the scenario and the validation in the planned task; the new block case `conform-part-spec-invalid` grades `Verdict: FAIL` on a built part whose added requirement has no scenario; the fixture part of `tally-spec-fix-part` names the validation; `implement-part-spec-delta` grades a scenario under the added requirement and the validation line in the report.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-auto-review`: "Fix parts" plans a requirement added by a spec-text fix with at least one scenario and verifies the task with `openspec validate <change> --strict`.
- `bdk-execute-blocks`: "Limits on what a block changes" allows `openspec validate <change> --strict`; "Part checks" runs it on a part that changes a delta; "Conform the part's diff" fails a part whose delta OpenSpec refuses.
- `bdk-spec-conformance`: "Eval cases of spec conformance in the review round" holds the new graders and the case `conform-part-spec-invalid`.

## Impact

- `plugins/bdk/skills/plan-fixes/SKILL.md`, `plugins/bdk/skills/implement-part/SKILL.md`, `plugins/bdk/skills/conform-part/SKILL.md` (and their `allowed-tools`: `Bash(openspec validate *)`).
- `plugins/bdk/evals/plan-fixes-spec-delta/graders/`, `plugins/bdk/evals/implement-part-spec-delta/graders/`, `plugins/bdk/evals/conform-part-spec-invalid/` (new), `plugins/bdk/evals/fixtures/tally-spec-fix-part.sh`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/` pages that describe the fix pass and the execute blocks' checks; `docs/reference/` regenerated with `pnpm docs:reference`. No diagram changes: no step, exit, file or agent of a flow is added or removed.
- Out of scope: how a review round's `spec-conformance` levels a delta OpenSpec refuses (#374).
