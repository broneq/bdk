# Design

## Context

See proposal.md - Why. `plugins/bdk/skills/judge/SKILL.md` step 3 levels by the product's behaviour (ADR-0003, D2 in `docs/design/2026-10-07-v3-skills-decisions.md`): `blocker` when the product breaks a scenario, `should-fix` when it works but breaks a rule or has a named maintenance cost, `nice-to-have` for an improvement whose absence costs nothing concrete. A missing test with the behaviour present fits none of the first two by their words, so a judge reads it as `nice-to-have`, and `/bdk:triage` (auto) defers it. #346 made a test-only fix part for present behaviour buildable; it only helps once the judge levels the gap `should-fix`.

## Goals / Non-Goals

**Goals:**

- A scenario the Change owes that no test verifies is fixed in the review loop.
- A test gap the Change does not owe stays `nice-to-have`, so the loop does not grow with tests nobody asked for.

**Non-Goals:**

- Changing triage, `plan-fixes` or the fix pass (#346 covers them).
- Making reviewers look for test gaps (they already do: `review-integration` checks "a test for each scenario at the level that proves it").

## Decisions

### D1. Level: `should-fix`

A scenario without a test, with the behaviour present, is `should-fix`.

- Alternative: `blocker` - lost: the product does what the scenario says, and a `blocker` means the product is broken; levelling a missing test like a broken scenario would also stop a last round `blocked` on a gap the user could accept. `should-fix` is fixed in every round but the last one, which matches its cost.
- Alternative: keep `nice-to-have` and rely on the reviewer to word a maintenance cost - lost: the #258 reviewer did word it ("deleting the check keeps every test green") and the judge still read "only a test is missing"; the cost is fixed by the Change's own contract, so the table states it instead of leaving it to wording.

The cost is concrete: the plan's acceptance for that scenario is not met (`Verified by` names a test that does not exist), and a regression of the scenario would pass every check of every later run.

### D2. What the Change owes: the scenarios of its spec deltas, and the scenarios its plan parts name

The judge tells a scenario test the Change owes from a nice-to-have gap by where the scenario comes from: it is in the Change's spec deltas, or a plan part names it under `Acceptance scenarios` or `Verified by`. Anything else (a case of a scenario's requirement no scenario writes out, a main-spec scenario the Change does not touch, a branch of a helper) is `nice-to-have`.

- Alternative: only `Verified by` - lost: `Acceptance scenarios` lists the scenarios the part must make true, and a part may verify a scenario through a task whose `Verified by` names only the test file (part 02 of `monthly-report`); the delta itself is the Change's contract whether or not a plan exists (`/bdk:pr-review` without a plan).
- Alternative: every requirement sentence - lost: tests per input class are an improvement the scenarios do not ask for; `spec-conformance` already checks SHALL sentences against the product (#265), so the product side is covered.

### D3. When the finding holds

It holds when the judge finds no test that would fail if the scenario's behaviour broke; a test that exercises the scenario indirectly, at another level, guards it and makes the finding `not-a-problem`. This keeps question 1 of step 3 ("a test that already prevents it makes it a false positive") the single way a finding fails to hold. If the product breaks the scenario, the finding is a `blocker` by the existing row.

### D4. Eval case on the existing fixture `tally-total-untested`

`judge-scenario-no-test` reuses `fixtures/tally-total-untested.sh` (#346), which already builds this exact situation (scenario `Empty ledger` listed by part 01, done by the code, untested), and rewrites round 1 into three unleveled findings without a report. None names its scenario, as the #258 finding did not ("No test for the same-account error of transfer"), so the judge must find it: `tally total` without a ledger (`Empty ledger`), `tally --help` (`Help`, a MODIFIED scenario of the delta that the evidence calls cosmetic), and `tally total` on negative amounts, a gap of the same command no scenario asks for. Every evidence says the behaviour is right, only a test is missing, and a regression would pass every test, so the case shows that the scenario, not the wording, decides the level.

- Alternative: a new finding on `monthly-report` - lost: its Change has the parse bug, so a "no test" finding on part 01 there would be a `blocker`; the tally fixture is the one where the behaviour is present.
- Alternative: add the findings to `judge-levels` - lost: that case grades the four-level mix of D2; a separate case keeps each case about one rule and its 3-of-3 signal clean.

### D5. Step 2 reads the plan parts for a missing-test finding

The judge read only the proposal and the spec scenarios in step 2; D2 also counts the plan parts' `Acceptance scenarios` and `Verified by` lines, so step 2 reads them when a finding says a test is missing, and only then (the other levels do not need the plan, and a round of many findings stays fast).

### D6. The case guards the rule; it does not reproduce #258

Decided without the user. The run data of the #258 round is gone, and the small case does not reproduce its `nice-to-have`: the judge of `staging/v3` before this change levelled the case right in 3 of 3 runs on the default model and on sonnet (the model of `bdk:judge`), and on sonnet with eight more findings of mixed levels in the round. The #258 judge levelled 13 findings of a seven-capability Change in 17 s and gave the reason "only a test is missing", so the likely cause is a judge under load reading the level from the evidence's wording when the table has no line for the case. The change states the rule (D1-D3) so the level no longer rests on inference; the case keeps the rule from regressing and is the issue's acceptance signal. A B1-sized re-run would be one more sample of a non-deterministic step; a later B1-sized run with seeds, as #258 ran, shows whether a seeded scenario without a test is fixed.

- Alternative: rebuild the #258 round as a fixture (the B1 build plus the six seeds and 13 findings) - lost: no B1 build fixture exists (`household-book-planned.sh` stops before execute), building one is the scope of the measurement issues, and a case that costs a full build per run would not run in the 3-of-3 signal the issue asks for.

## Risks / Trade-offs

- More `should-fix` findings per round, so more fix parts: each is test-only and small (#346), and the gap would otherwise reach the pull request.
- A judge may still read a test gap of a delta scenario's requirement sentence as owed: the reason and the case's second finding name the rule.
