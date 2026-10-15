# Proposal

## Why

Tracks #423. `bdk:designer` and `bdk:planner` run on `model: inherit`, the session's model (`sonnet` by default). In the OCR-376 comparison (`.bdk/analysis/projects-compare/WHY-sw-better.md`, section 6) the signal-workflow arm ran its analysis, specification and plan roles on `opus` at a similar cost per role and caught more, but on one run per arm. Decision D5 of the session of 2026-10-15 set the order: the explorer moved to `sonnet` in #410; `opus` for the designer and the planner only after a measurement.

## What Changes

- New block case `design-draft-acceptance`: the explored `add-csv-export` as the new propose of #422 leaves it (issue 7 saved, AC-1 to AC-4 in the proposal, AC-4 a semicolon option that needs a real decision), under `policy.questions: decide-and-record`. It grades that every AC is answered by the spec delta, that the design reuses `listEntries` and `formatCents`, and that no AC is handed to the user. The AC part of the shared fixture `ledger-acceptance.sh` moves to `fixtures/ledger-acceptance/criteria.sh`, which both use.
- `design-draft-acceptance` and `plan-draft-household-book` run on `sonnet` and on `opus`; each artifact is checked by the fixed `bdk:verifier` (`opus`). The comparison, its measure (stated before the runs, design D4) and the cost are recorded in the design and in `plugins/bdk/evals/README.md`.
- `bdk:designer` moves from `model: inherit` to `model: opus` (design D5); `bdk:planner` stays on `inherit` (D6). A project still sets either with `models.designer.model` and `models.planner.model`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-blocks`: the designer's default model and the new eval case.

## Out of scope

- Other agents' models: the explorer was decided in #410; the verifier and the integration reviewer stay on `opus`.
- The models of the main thread and of the progress summaries.

## Impact

- `plugins/bdk/evals/design-draft-acceptance/`, `plugins/bdk/evals/fixtures/ledger-acceptance.sh`, `plugins/bdk/evals/fixtures/ledger-acceptance/criteria.sh`, `plugins/bdk/evals/README.md`; `plugins/bdk/agents/designer.md`.
- User docs that name the designer's and the planner's model: `docs/guide/footprint.md`, `docs/concepts/agents.md` (its diagram and table), `docs/guide/configuration.md` ("Choose models"); `docs/design/2026-10-07-v3-architecture.md` names the agents' models in its table of blocks and is updated too; Reference regenerated (`docs/reference/bdk/agents.md`).
- Cost: every `/bdk:design` runs its designer on `opus`; measured at about the cost of the `sonnet` loop, which needed a fix round (design, "Measurement"). Paid runs of this Change: $9.10 of the $20 Budget.
