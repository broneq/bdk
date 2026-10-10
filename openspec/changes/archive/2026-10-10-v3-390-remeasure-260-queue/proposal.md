# Proposal

## Why

Tracks #390.

The unattended queue of #260 (Change `v3-260-measure-run-multi-change-queue`, design "Measurement") stopped at execute of its third Change with a `plan-defect`: the plan listed 17 scenarios of four MODIFIED requirements, 7 of them already satisfied by the code, none marked ` (behaviour present)`, and the implementer stopped when their tests passed at once. #382 (Change `v3-382-plan-draft-present-scenarios`) made `plan-draft` mark present scenarios and `verify-plan` check the markers, and measured it on block cases only; its design "Results" leaves the queue itself as this follow-up.

## What Changes

- A manual paid re-run, outside this repository, of the #260 queue as its design D1, D2 and D4 describe it: `/bdk:run #1 #2 #3 #4` on the first commit of the `ledger` fixture (#243), non-interactive, with the merge of Change 3's pull request before Change 4 resumes.
- The report, recorded in this Change's design ("Measurement"): per Change, whether execute stopped and why, the scenarios each plan lists, how many it marks present and whether each mark held at the implementer's first test run; per session, time, cost and how it ended; compared with #260.
- An issue for each defect the run shows that this task does not fix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The output is a measurement (`skip_specs: true`).

## Out of scope

- #391 (close refuses an E2E failure the judge deferred): a stop at close is after execute and is recorded, not fixed.
- The run loop's decisions of #260 (M1-M3) and the solo run of its design D3: they are not reopened.

## Impact

- New: this Change's artifacts only (the report in `design.md`).
- No change to skills, agents, the CLI, fixtures, `package.json`, the lockfile or shared configuration; nothing a BDK user sees changes, so there is no Docs task group and no user docs page is updated.
