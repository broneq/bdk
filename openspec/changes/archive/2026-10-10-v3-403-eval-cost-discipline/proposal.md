# Proposal

## Why

Tracks #403.

Paid measurements spend the account's usage limit, and nothing written tells their author when a run is worth it or makes them record what it cost. A review of the measuring issues of Phase 6 and the B1 runs of Phase 7 (the archived Changes `v3-208`, `v3-242`, `v3-243`, `v3-249`, `v3-253`, `v3-260`, `v3-262`, `v3-263`, `v3-264`, `v3-265`, `v3-290`, `v3-322`, `v3-368`, `v3-370`, sections "Measurement" / "Results") found about $70 recorded and an estimated $130-150 in all, with the total recorded by two of the twelve Phase 6 Changes only. Full B1 runs paid off as discovery and not as confirmation; iterating on the whole case set and running both arms for a "does it work" question multiplied the cost; an "N of N" acceptance for a rare flake passes without a fix about a quarter of the time.

## What Changes

- Spec `skill-evals` gains a requirement for paid measurement: the eval README says how to keep a paid run small and when a full B1 run is worth it, a measuring Change records the total cost of every paid run, and a flaky case is accepted by its cause.
- Spec `skill-evals` "Block and orchestrator cases": a block case keeps graders that hold in both arms; both arms run when the question is whether the block changes the outcome (ADR-0003, architecture design "Evals and the development rule"), while a run that confirms a fix or checks a regression may run one arm.
- `plugins/bdk/evals/README.md`: a "Before a paid run" part under "Run" and a "Flaky cases" part next to "Host limits".
- `CLAUDE.md` SDLC "Create": an issue that pays for model runs carries a `Budget` section; before measuring, check that the question is not already answered.
- `openspec/config.yaml`: the issue sections in `context` name `Budget`, and a design rule asks a design that measures to record the total cost.
- `plugins/bdk/tests/evals.test.ts`: a free check that the README keeps the "Before a paid run" part.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: new requirement "Paid measurement discipline"; "Block and orchestrator cases" says when a block case runs both arms.

## Impact

- Changed: `plugins/bdk/evals/README.md`, `plugins/bdk/tests/evals.test.ts`, `CLAUDE.md`, `openspec/config.yaml`, spec `openspec/specs/skill-evals/spec.md`.
- No paid run: the rules come from the recorded costs of the archived Changes above.
- Nothing a BDK user sees changes (no skill, agent, hook, `bdk` command, settings key or flow), so no `docs/guide/` or `docs/concepts/` page changes and there is no Docs task group; the PR body carries `Docs-impact: none`.
- Out of scope: re-measuring or changing any skill; #402 (open) records results in the README's "Recorded" lines, which this Change does not touch.
