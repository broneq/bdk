# Proposal

## Why

Tracks #242.

`plan-draft` showed Δ 0.00 on both of its cases (`2026-10-08-v3-191-plan-blocks`, design "Eval results"): on a six-scenario Change the BDK schema's plan instruction and part template already teach the part format, and a run without the plugin follows them. What the skill adds over the schema (`bdk plan check` with the project's limits, self-contained parts, the stop on a design gap) needs a Change large enough to exercise it. The B1-sized fixture (#243) is that Change; this task measures `plan-draft` on it and decides whether the block keeps its place.

## What Changes

- New block case `plugins/bdk/evals/plan-draft-household-book/`: `plan-draft` on the ready-to-plan state of the B1-sized fixture (`household-book.sh`), run with and without the plugin.
- A recorded with/without measurement of the arms' plans on that case: the harness score, and per run the properties of the plan the run wrote (`bdk plan check` with the default limits, waves, scenario ownership, task contracts) and the verdict of `verify-plan` on it, with time and cost.
- A keep, change or remove decision for `plan-draft`, recorded in this Change's design, and applied: a change to the skill when the measurement shows a concrete gap, a follow-up issue for what this task does not settle.
- `plugins/bdk/evals/README.md`: how to run the case, and the scenario count of the fixture corrected to 71.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: a requirement for the plan-draft case on the B1-sized fixture.

## Out of scope

- The speed measurement of execute and plan-to-PR (#208).
- A design-gap case on the B1-sized fixture: the fixture's design is approved and holds no gap; a fixture variant with one is a follow-up if the decision needs it.
- `/bdk:plan` (#199, merged) and `verify-plan` (#191): not changed unless the decision moves work between them.

## Impact

- New: `plugins/bdk/evals/plan-draft-household-book/`.
- Changed: `plugins/bdk/evals/README.md` (shared with other agents' eval cases); `plugins/bdk/skills/plan-draft/` only if the decision is "change".
- No change to `package.json`, the lockfile, the CLI or shared configuration.
