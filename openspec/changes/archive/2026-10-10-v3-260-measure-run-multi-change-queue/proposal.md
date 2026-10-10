# Proposal

## Why

Tracks #260.

`/bdk:run` (#203) was measured on one two-Change run from issues ($6.40, three sessions, two of them resumes after a stop it did not cause) and, by #266 and #258, on a single B1-sized Change from a queued state. Three decisions of #203 were deferred until a longer unattended queue is measured:

- **One session per queue or per Change** (architecture "Risks", the bottleneck row): the main thread runs propose, design, plan, triage and close for every Change in one context; a drop in quality per Change along the queue, or compactions, is the trigger for one session per Change.
- **The deferred `Stop` hook engine** (architecture "Autopilot continuation", the SPOF row "the model leaves the `/bdk:run` loop early"): built only when runs stop without a reason.
- **Park instead of stop** (Change `v3-203-bdk-run`, design D6): a stage that does not reach its end stops the whole queue; parking it and going on with the next independent Change was lost for v3.0, to be revisited with a measured unattended run.

## What Changes

- Manual paid runs, outside this repository: `/bdk:run` over a queue of four Changes from issues (two independent, one chain of two) on the `ledger` CLI of the B1-sized fixture (#243) at its base commit, non-interactive, `policy.gates.*: auto`, `policy.questions: decide-and-record`, `execution.lead: foreground`.
- The report, recorded in this Change's design ("Measurement"): per Change turns, time, cost, compactions, stops and their cause; per session Changes finished; every early stop of the loop; the main thread's context along the queue; the quality of each Change (review findings, close, the product used by hand), compared with one Change of the queue run alone in a fresh session.
- From that, a decision on the deferred hook engine, on parking and on one session per Change, recorded in the design.
- An issue for each concrete defect or slowness the runs show that this task does not fix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The output is a measurement (`skip_specs: true`).

## Out of scope

- Building the hook engine, parking or one session per Change: each, when the measurement calls for it, becomes its own issue.
- The speed of single stages (#266) and the review's correctness (#258).

## Impact

- New: this Change's artifacts only (the report in `design.md`).
- No change to skills, agents, the CLI, fixtures, `package.json`, the lockfile or shared configuration; nothing a BDK user sees changes, so there is no Docs task group and no user docs page is updated.
