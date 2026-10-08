# Proposal

## Why

Tracks #208.

The architecture sets the speed targets of v3 on a Change the size of B1 (`docs/design/2026-10-07-v3-architecture.md`, "Product requirements", Speed): execute <= 15 min, approved plan to PR <= 45 min of machine time with `auto` gates; its "Risks" table lists "15 min execute is reachable" as an assumption to measure on the B1 fixture, and "Testing" says that fixture runs by hand because it is paid. Every stage from execute to close is now merged (#200, #201, #202, #203) and the B1-sized fixture exists (#243), so the targets can be measured. B1 itself took 47 min for execute and about 3 h of machine work in all (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "1. Speed").

## What Changes

- New shared fixture `plugins/bdk/evals/fixtures/household-book-queued.sh`: the planned state of the B1-sized fixture (`household-book-planned.sh`) made ready for an unattended plan-to-PR run: a bare `origin` inside the workspace, the offline `gh` stand-in, `.bdk/runs/run.json` queueing `add-household-book`, and `.bdk/settings.local.yaml` with `auto` gates, `decide-and-record` questions and a foreground lead (the host stops a background lead in `claude -p`, eval README "Host limits").
- Manual paid runs: `claude -p "/bdk:run"` on that workspace (two runs, design "Measurement"), outside this repository, measuring wall time per stage (execute, auto-review rounds, close), waves and per-part times, turns, agents and cost, from the session transcripts and the run files.
- The report, recorded in this Change's design ("Measurement"): execute time and plan-to-PR time against the 15 and 45 minute targets, compared with B1, and what the time went to.
- A follow-up issue for each concrete slowness the run shows that this task does not fix.
- A correction of the B1-sized fixture where the first run showed it was wrong (design D6): spec `ledger` "Options", design D2 and part 01 state the argument errors every command shares; part 04 reads the statement path with `resolve`; the design and plan approval records replaced by real verifier runs on the corrected files.
- `plugins/bdk/evals/README.md`: the queued state, its run command and the recorded result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the B1-sized fixture gains a third state, ready for an unattended plan-to-PR run.

## Out of scope

- Speeding up a stage: this task measures; a slowness it finds becomes its own issue.
- The review stage's correctness and per-round detail on this Change (#258), and a multi-Change queue (#260).
- `plan-draft` on the B1-sized fixture (#242, merged).

## Impact

- New: `plugins/bdk/evals/fixtures/household-book-queued.sh`.
- Changed: `plugins/bdk/evals/README.md` and `plugins/bdk/tests/household-book.test.ts` (shared with other agents' eval work); `plugins/bdk/evals/fixtures/household-book/` (spec `ledger`, design, parts 01 and 04, `runs/design/verify-3.md`, `gate.md`, `runs/plan/verify-1.md`).
- No change to skills, agents, the CLI, `package.json`, the lockfile or shared configuration.
