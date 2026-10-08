# Proposal

## Why

Tracks #243.

The speed targets of v3 are set on a Change the size of B1 (design `2026-10-07-v3-architecture.md`, "Product requirements", Speed: 27 tasks, 62 files; execute <= 15 min, approved plan to PR <= 45 min), and "Stages and units of work" names wave depth as the driver of execute time. Every eval fixture so far holds a Change of one or two parts (`ledger-change.sh`: six scenarios), which is too small to show what `plan-draft` adds over the BDK schema (#191 design, "Eval results": Δ 0.00) or to time execute. #242 (plan-draft with/without) and #208 (speed measurement) both need a B1-sized Change; this task builds it on its own, so neither waits for `/bdk:run`.

## What Changes

- New shared fixture `plugins/bdk/evals/fixtures/household-book.sh`: a configured BDK project (the Node CLI `ledger`, its main spec, `.bdk/settings.yaml` with test and e2e tools, the BDK schema) holding one Change, `add-household-book`, of B1 size whose proposal, spec deltas and design are approved: the design's verifier reports (the last one passing) and `design/gate.md` under `.bdk/runs/`. Ready to plan.
- New shared fixture `plugins/bdk/evals/fixtures/household-book-planned.sh`: the same project one step later, with the Change's approved plan of 7 parts, 27 tasks and 62 files in 3 waves and a passing `plan/verify-1.md`. Ready to execute, or to run plan-to-PR.
- The Change's markdown (proposal, spec deltas, design, plan parts) lives as files under `plugins/bdk/evals/fixtures/household-book/`, which the two scripts copy.
- A free check in `plugins/bdk/tests/` that builds the planned state, runs `bdk plan check` on it, and asserts its size, waves and scenario ownership, and that the base project's own tests pass.
- A block case `verify-plan-household-book` on the planned state, and one recorded probe run of it (one arm, `--runs 1`).
- `plugins/bdk/evals/README.md` documents both fixtures and how to run them by hand.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: a requirement for the B1-sized fixture: its size, its two states, what the planned state passes, and its documentation.

## Out of scope

- The plan-draft with/without measurement and its keep/change/remove decision (#242).
- The paid speed run and its report (#208); `/bdk:execute` (#203) and `/bdk:plan` (#199), which the fixture is ready for but does not run.
- Any new `bdk` command or skill.

## Impact

- New: `plugins/bdk/evals/fixtures/household-book.sh`, `household-book-planned.sh`, `household-book/`, `plugins/bdk/evals/verify-plan-household-book/`, `plugins/bdk/tests/household-book.test.ts`.
- Changed: `plugins/bdk/evals/README.md` (shared with other agents' eval cases).
- No change to `package.json`, the lockfile, the CLI, skills or shared configuration.
