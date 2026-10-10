# Proposal

## Why

Tracks #368.

Run 1 of the B1 measurement (#208, archived Change `v3-208-measure-speed-b1`, design D6 and "Measurement") stopped at `/bdk:close` on `spec-conformance` after 22 min of a run that every review round had passed: argument errors no spec delta listed, and an absolute statement path read under the current directory. #265 (archived Change `v3-265-spec-conformance-in-review`) moved the same check into every review round, proven on the small fixture `tally-ledger-path.sh`; its "Risks" left the B1-sized run as this follow-up. This Change measures whether an unattended B1-sized run now reaches its pull request on the Change that stopped run 1.

## What Changes

- New shared fixture `plugins/bdk/evals/fixtures/household-book-uncorrected.sh`: the queued state (`household-book-queued.sh`) with the Change as run 1 found it, before #208's correction (D6): spec `ledger` "Options", design D2 and part 01 without the shared argument errors, part 04 reading `join(io.cwd, file)`, the design gate on `verify-2.md`, and the plan record of that plan. The difference is one patch, `fixtures/household-book/uncorrected.patch`, folded into the planned commit.
- Its free check in `plugins/bdk/tests/household-book.test.ts`.
- A manual paid run: `claude -p "/bdk:run"` on that workspace, outside this repository, by the method of #208 (design D3 of `v3-208-measure-speed-b1`).
- The report in this Change's design ("Measurement"): the round in which the `spec-conformance` findings appear and how the judge levels them, how triage, `plan-fixes` and the fix pass handle them, the time and cost the verifier adds per round, and the close verdict.
- An issue for each product defect the run shows that this task does not fix.
- `plugins/bdk/evals/README.md`: the fourth state, its run command and the recorded result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the B1-sized fixture gains a fourth state, queued with the Change run 1 started from.

The issue's acceptance signal (the run reaches its PR with `Verdict: PASS`, or its stop is recorded with evidence) is the outcome of a paid manual run, recorded in design "Measurement" as #208 recorded its runs; it is not a requirement the suite can check.

## Out of scope

- Changing a skill, agent or CLI command: this task measures; a defect it finds becomes its own issue.
- Speed of the stages (#208, #263, #264), a multi-Change queue (#260) and the quality of review findings (#258).

## Impact

- New: `plugins/bdk/evals/fixtures/household-book-uncorrected.sh`, `plugins/bdk/evals/fixtures/household-book/uncorrected.patch`.
- Changed: `plugins/bdk/evals/README.md`, `plugins/bdk/tests/household-book.test.ts`.
- No user-visible change: no skill, agent, hook, `bdk` command or settings key changes, so no Guide or Concepts page and no Docs task group.
