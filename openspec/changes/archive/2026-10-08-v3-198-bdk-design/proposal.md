# Proposal

## Why

Tracks #198.

The design blocks exist (#190): `explore` maps the code, `design-draft` writes the spec deltas and `design.md`, `verify-design` checks them against the code. Nothing composes them yet, so a user (and later `/bdk:run`) has to run three commands, read each verdict, decide whether to fix and verify again, and decide when the design is approved. The architecture's "Flows / Design" names the composer: `/bdk:design`, an orchestrator in the main thread that loops the blocks to PASS or to a budget and ends with the design gate set by `policy.gates.design` ("Catalog", Orchestrators; ADR-0003 D1).

## What Changes

- New skill `/bdk:design` in `plugins/bdk/skills/design/`: an orchestrator that only composes. It maps the code with `explore` on `bdk:explorer`, drafts with `design-draft` in the main thread, verifies with `verify-design` on `bdk:verifier`, and on `Verdict: FAIL` runs `design-draft` to fix and verifies again with the same verifier, until a report passes or `policy.budgets.verifier` passes are used.
- Resume from files: the skill starts at the first missing run file (no `explore.md`, no `design.md`, no report, a failed last report), as the architecture's "Run state, run artifacts and resume" describes.
- The design gate by `policy.gates.design`: `manual` asks the user to approve the passed design (a request for changes goes back through `design-draft` and `verify-design`); `auto` approves it. The gate's outcome is written to the run file `design/gate.md`. A design that did not pass within the budget never reaches the gate.
- New configuration key `policy.budgets.verifier` (default 3): the most verifier passes one orchestrator run spends, the name the architecture uses in "Flows / Design" and "Flows / Plan".
- `design-draft` takes a revision request from its caller: with a `design.md` in place and a request in the arguments, it changes only what the request needs.
- Orchestrator eval cases (`tags: [orchestrator]`) with `tool_order` and `file_exists` graders (issue "Acceptance signal").

## Capabilities

### New Capabilities

- `bdk-design`: the `/bdk:design` orchestrator - configuration check, resume from run files, the explore / draft / verify loop with its budget, the design gate and its run file, the report, and its eval cases.

### Modified Capabilities

- `bdk-cli/config`: the settings table gains `policy.budgets.verifier` (integer, at least 1, default 3); the spec lets the consumer of a key add its row.
- `design-blocks`: `design-draft` revises a written design on a request named in its arguments.

## Out of scope

- `/bdk:plan` and its own use of `policy.budgets.verifier` (#199).
- `/bdk:run` and its gates over a queue of Changes.
- Block replacement through `steps.design`: the file contract a replacement block must meet is an open point of the architecture ("What we did NOT decide").
- Changes to `explore` and `verify-design`.

## Impact

- `plugins/bdk/skills/design/SKILL.md` (new), `plugins/bdk/skills/design-draft/SKILL.md` (revision request).
- `plugins/bdk/src/config/domain/settings.ts` and its tests (new key).
- `plugins/bdk/evals/design-*` orchestrator cases, `plugins/bdk/evals/README.md`.
- `CLAUDE.md` "Current state".
