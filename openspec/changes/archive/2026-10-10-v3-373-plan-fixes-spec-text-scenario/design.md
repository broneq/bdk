## Context

Tracks #373. Since #265 a review round runs `spec-conformance`, and a finding whose fix is spec text (source `spec-conformance`, placed on a delta) is planned by `plan-fixes` as a task on that delta, verified by the next round's spec check (#265 design D6). The task's part lists no acceptance scenario, because `implement-part` stops on an acceptance scenario that is not in the deltas yet, and a scenario the task is about to write is not.

In the #368 measurement the planner turned that rule into "Add no scenario" for a new requirement. OpenSpec refuses an ADDED or MODIFIED requirement without a `#### Scenario:` (`openspec validate --strict`, and `openspec archive`), so the fix pass wrote a delta close could not archive. Neither the implementer nor the conformer ran OpenSpec, and the round's verifier listed the failure as `Should consider` (#374), so the first stop was close, 35 minutes in.

Architecture: logic in skills; one block, one job (`docs/design/2026-10-07-v3-architecture.md`). The planner writes the task, the implementer builds and checks its own work, the conformer checks it as a stranger.

## Goals / Non-Goals

**Goals:** a fix part that adds a requirement plans its scenario; a delta that OpenSpec refuses is caught inside the part that wrote it, not at close.

**Non-Goals:** how a review round's `spec-conformance` levels such a delta (#374); validating deltas in plan parts written by `plan-draft` (the design stage writes deltas and already runs `openspec validate --strict` in `design-draft`).

## Decisions

### D1. The planned task names its scenario

A spec-text task that adds a requirement names at least one `#### Scenario:` for it, with the WHEN and the THEN the code gives (traced in step 2, as for any finding). A task that corrects an existing requirement keeps or adjusts its scenarios. The rule about the part's `## Acceptance scenarios` stays, reworded to say what it is about: the part lists no acceptance scenario because the scenario the task writes is not in the delta yet, not because the delta gets none.

Rejected: leaving the scenario to the implementer. The implementer builds the task as written; "Add no scenario" in the task was followed literally, and a scenario whose THEN must come from traced code belongs in the plan, where the planner already traced it.

### D2. `Verified by:` names `openspec validate <change> --strict`

The task's check becomes `openspec validate <change> --strict passes; the spec check of the next review round`. Validation is local, reads files only and costs nothing; it catches the structural error in seconds, while the spec check only reads meaning and runs a full round later. Naming it in `Verified by:` also gives the conformer a concrete check to hold the task to (its step 4 checks each task's `Verified by`).

### D3. Both execute blocks run the validation on a part that changes a delta (the issue's open question)

The issue asks whether `implement-part` or `conform-part` runs `openspec validate --strict`. Both do, each in its own role, only when the part's diff changes a file under `openspec/changes/<change>/specs/`:

- `implement-part` runs it in step 6 with the part checks, fixes what it reports in the part's files and runs it again, three runs in all, like `bdk check run`. An author that sees its own error fixes it in the same turn, with no retry of the part. A result still failing after three runs is a blocker of kind `other`.
- `conform-part` runs it in step 4 as the task check, whatever the implementer reports (its rule: judge from the code, a report is a claim). An error on a delta of the part is a `Left` item naming the task; adding a scenario adds spec content, which the conformer never does, so the verdict is `FAIL` and the lead retries the part with that item to do.

Rejected: only the conformer. Correct, but every invalid delta would cost a whole retry of the part. Rejected: only the implementer. The #368 run shows an author that wrote what its task said and stopped; the independent check is what v3 adds over v2 (stages.md: the author never checks its own work).

Rejected: a `bdk` command or a `tools` item for the validation. The skills of the design stage already call `openspec validate` directly; a CLI wrapper would add code for one command line with no problem measured (CLAUDE.md, "Building skills"). The limits of the execute blocks ("checks only through `bdk check run`") are widened by this one command, named exactly in `allowed-tools` as `Bash(openspec validate *)`.

### D4. No OpenSpec CLI is not a blocker

The execute blocks never install or reach the network, so `npx -y @fission-ai/openspec` is not an option there. When `openspec` is not found, the block writes `openspec validate: not run, no OpenSpec CLI` under `## Checks` and goes on: the round's spec check and close still read the delta, and `/bdk:setup` asks for the CLI. Blocking a part over a missing optional tool would stop runs that worked before this Change.

### D5. Errors outside the part's deltas are not the part's

`openspec validate <change>` checks the whole Change. An error on a file outside the part's `files` (another part's delta, the proposal) is not the part's to fix: the implementer notes it under `Decisions taken without the user`, the conformer under `Left` as `outside the part`; neither fails the part for it.

### D6. Eval cases

- `plan-fixes-spec-delta`: the error-message finding needs a new requirement (no requirement of the delta or of the main spec describes it), which is the shape of #368. Two new graders on the written part: `delta-task-scenario` (the task for the finding asks for a `#### Scenario:` with WHEN and THEN and the error text) and `delta-task-validated` (`openspec validate add-total --strict` in the task).
- `tally-spec-fix-part.sh`: the fixture part's `Verified by:` names the validation, as `plan-fixes` now writes it.
- `implement-part-spec-delta`: a grader that the added requirement has a `#### Scenario:`, and one that the report's `## Checks` names the validation.
- New `conform-part-spec-invalid`: the part built with requirement `Bad amount` and no scenario, the implementer report `Status: done`; graders `Verdict: FAIL`, a `Left` item naming task 1, and no `Edit` of the delta. Its grants add `Bash(openspec validate *)`.

## Measurement

2026-10-10, Claude Code 2.1.296, with the plugin unless noted:

- Before (skills of `staging/v3` plus the new graders): `plan-fixes-spec-delta` 0.67 over 3 runs and 0.88 in a fourth; the task named a `#### Scenario:` with WHEN and THEN in 1 of 4 runs, `openspec validate` in none. One of the 3 runs also wrote no `index.md`.
- After: `plan-fixes-spec-delta` WITH 1.00 / W/OUT 0.14 (3 runs per arm); `conform-part-spec-invalid` WITH 1.00 / W/OUT 0.25; `implement-part-spec-delta` and `conform-part-spec-delta` 1.00 in 3 of 3 runs each, with the new graders.

## Risks / Trade-offs

- [The eval runs need a global OpenSpec outside the home directory] - the cases that call OpenSpec already need it (README "Host limits"); without it the blocks write the `not run` line and the validation graders fail, which the README says.
- [The acceptance signal "no close stops on a delta without a scenario" on the B1-sized Change needs a full run] - #368 measures that run; this Change gives the block evidence.
