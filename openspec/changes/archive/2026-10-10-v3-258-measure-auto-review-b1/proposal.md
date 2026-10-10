# Proposal

## Why

Tracks #258.

`/bdk:auto-review` (#201) was measured on the two-file `monthly-report` fixture, and its speed on the B1-sized Change in #266 (Change `v3-208-measure-speed-b1`, design "Measurement > Review"): two rounds of about 12 min in all. What #266 did not judge is the review's correctness on that Change: which real defects it finds and which it misses, how many of its findings are false, and how much the main thread's context grows per round, since triage and `plan-fixes` run there. Run 1 of #266 showed a miss (an absolute statement path read under the working directory) that both review rounds and the E2E tester let through to close. #263, #264, #265, #321 and #326 have since changed the review stage, so it is measured again as it is now.

The B1 baseline (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "1. Speed" and "2. Correctness"; full report `2026-10-06-b1-full-run-report.md`, section 7): 4 review rounds, 55 agents; the integration review caught the only product blocker (a seam across parts that 27 green tasks missed); rounds 3 and 4 held 2 and 1 minor entries.

## What Changes

- Manual paid runs, outside this repository, on the B1-sized fixture of #243 built by `/bdk:execute` (`household-book-queued.sh`, `execution.lead: foreground`):
  - one build, copied for each review run, so every run reviews the same code;
  - run A: `/bdk:auto-review` on the build as `/bdk:execute` left it; every finding judged real or false by hand, and the product audited by hand against its spec scenarios for defects the review missed;
  - run B: the same build with a set of seeded defects of the classes B1 and #266 met (a cross-part seam, a path bug, a spec gap, a logic bug in one part, a missing test), committed as part of the Change; recall against that set.
- The report, recorded in this Change's design ("Measurement"): per round wall time, groups and reviewers, findings by level and source, decisions, fix parts, fix pass time and cost; whether `execution.max-parallel` binds; whether round 2 stays within the fix scope; the main thread's context after each round; found, missed and false defects; compared with the B1 baseline and #266.
- An issue for each concrete slowness or missed defect class the runs show that this task does not fix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The output is a measurement (`skip_specs: true`).

## Out of scope

- Fixing a slowness or a miss: each becomes its own issue.
- A queue of several Changes (#260).
- The speed of the other stages, measured in #266.

## Impact

- New: this Change's artifacts only (the report in `design.md`).
- No change to skills, agents, the CLI, fixtures, `package.json`, the lockfile or shared configuration; nothing a BDK user sees changes, so there is no Docs task group and no user docs page is updated.
