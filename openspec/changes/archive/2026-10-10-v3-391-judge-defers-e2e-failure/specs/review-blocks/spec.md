## MODIFIED Requirements

### Requirement: Levels by the product's behaviour

The judge SHALL judge every finding of the log that has no level, once each: it SHALL check the failure scenario against the code at the finding's place and set one level with `bdk findings level` and a one-sentence `--reason`, by these definitions:

| Level | When |
|---|---|
| `blocker` | the product breaks a spec scenario or the intent of the Change; the spec deltas would not describe the product after archive (a `spec-conformance` finding whose problem holds); an E2E path fails (an `e2e-check` finding that holds); a check is red; a security hole; data loss; a regression of existing behaviour |
| `should-fix` | the product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost that the finding names; or a scenario the Change owes has no test |
| `nice-to-have` | an improvement whose absence costs nothing concrete, including a test that no scenario the Change owes asks for |
| `not-a-problem` | the failure scenario does not hold, the finding is out of the Change's scope or already handled, or it repeats an earlier finding of the log, whose id the reason names |

The Change SHALL be taken to owe a scenario's test when the scenario is in the Change's spec deltas, or a plan part of the Change names it under `Acceptance scenarios` or `Verified by`. A finding that such a scenario has no test SHALL hold when the judge finds no test that would fail if the scenario's behaviour broke; it SHALL be `should-fix` while the product does what the scenario says, and `blocker` when the product breaks the scenario.

Of two findings that repeat each other, the judge SHALL level the later one in the log `not-a-problem` and judge the earlier one on its own. A rule violation by itself SHALL NOT be a `blocker`. For a `spec-conformance` finding the judge SHALL check both sides: what the cited spec location says, and what the code does for the input the evidence names; the finding holds when they disagree, and `/bdk:close` would refuse to archive the Change while it is open. A `spec-conformance` finding whose evidence is an error of `openspec validate --strict` holds while the delta still has what the error names (a requirement without a scenario), even though the product does what the delta says; it is a `blocker`, because `openspec archive` refuses the Change. For an `e2e-check` finding the judge SHALL read the path file its evidence names and trace the path's input through the code; the finding holds when the code gives what the file observed. A holding `e2e-check` finding SHALL be a `blocker`, also when the spec deltas or the Change's `design.md` word the promise more narrowly than the proposal line it points at or leave its input out, and also for a `break` path held to the baseline, because `/bdk:close` refuses to archive the Change while an E2E path fails; a delta or design narrower than the proposal is a gap in them, not a narrower promise. An `e2e-check` finding whose observation the code does not give SHALL be `not-a-problem`. The judge SHALL add no finding, record no decision, and leave a finding that already has a level as it is.

#### Scenario: Levels of a mixed round

- **WHEN** the judge runs on a log holding the decimal-place bug of `parseEntries`, an abbreviated name citing `BDK-CQ-1`, a crash on empty input that a guard already prevents, and an optional sort order
- **THEN** their latest levels are `blocker`, `should-fix`, `not-a-problem` and `nice-to-have`

#### Scenario: Resumed judge

- **WHEN** a judge crashed after leveling two of four findings and runs again
- **THEN** it levels only the other two, and the first two keep their levels

#### Scenario: A previous finding reported again

- **WHEN** the log holds a seeded `previous-review` finding of the parse bug and, later, a `review-group` finding of the same bug, and the bug is still there
- **THEN** the seeded finding is `blocker` and the later finding is `not-a-problem` with a reason naming the seeded finding's id

#### Scenario: Error message no delta lists

- **WHEN** the log holds an unleveled `spec-conformance` finding that no delta of `add-total` lists the error `tally: not an amount: <text>`, and `bin/tally.js` prints it for `tally add abc`
- **THEN** its level is `blocker`, not `should-fix`, although the product works

#### Scenario: Delta OpenSpec refuses

- **WHEN** the log holds an unleveled `spec-conformance` finding that the requirement Bad amount of the `add-total` delta has no scenario, quoting `openspec validate add-total --strict`, and the delta still has none, while `bin/tally.js` prints the error the requirement names
- **THEN** its level is `blocker`, not `nice-to-have` or `not-a-problem`, although the product works

#### Scenario: E2E failure of a promise the delta words narrowly

- **WHEN** the log holds two unleveled `e2e-check` findings at the proposal line of `add-total` that promises `tally total` refuses a broken ledger with `tally: cannot read ledger.json` and exit 2, the delta says so only for a ledger that is not valid JSON or not an array, `design.md` decides that `total` does not check each entry, and the code prints a `TypeError` stack trace for `["abc"]` and `Total: 6.00` with exit 0 for `[true, 5]`
- **THEN** both levels are `blocker`, not `nice-to-have` or `should-fix`

#### Scenario: Scenario of the Change without a test

- **WHEN** the log holds an unleveled finding that the scenario `Empty ledger` of the `add-total` delta has no test, part 01 lists it under `Acceptance scenarios`, and `tally total` prints `Total: 0.00` without a ledger
- **THEN** its level is `should-fix`, not `nice-to-have`

#### Scenario: Test gap no scenario asks for

- **WHEN** the log holds an unleveled finding that no test covers `tally total` on a ledger of negative amounts, and no scenario of the delta or a plan part names that case
- **THEN** its level is `nice-to-have`

### Requirement: Eval cases of the review blocks

The suite SHALL hold the block cases `review-group-logic-bug`, `review-integration-seam` and `judge-levels`, tagged `block`, built from the shared fixture `monthly-report`: a configured BDK project whose branch carries a Change of two plan parts, with a logic bug inside part 01 and a seam bug between parts 01 and 02 that every test of the parts misses, and a recorded round 1. Each case SHALL grade the findings log, check that no project file was edited, and show the block fired. Run with and without the plugin, each case SHALL report a with-arm score above the without-arm score, and the `review-integration-seam` case SHALL pass its seam grader with the plugin.

The suite SHALL also hold the block cases `review-group-instruction` and `judge-instruction`, tagged `block`, built from the shared fixture `monthly-report-instructions`: the `monthly-report` fixture with a `CLAUDE.md` on `main` holding an instruction that part 01 breaks. `review-group-instruction` SHALL grade a `review-group` finding citing `CLAUDE.md`; `judge-instruction` SHALL grade the level `should-fix` for a finding that cites the broken instruction and `not-a-problem` for a finding that cites an instruction `CLAUDE.md` does not hold.

The suite SHALL also hold the block case `judge-previous-repeat`, tagged `block`, on the `monthly-report` fixture with a log holding a seeded `previous-review` finding of the parse bug and, after it, a `review-group` finding of the same bug worded differently; it SHALL grade that the seeded finding is `blocker` and never `not-a-problem`, and that the later finding is `not-a-problem` with a reason naming the seeded finding's id.

The suite SHALL also hold the block case `judge-spec-conformance`, tagged `block`, on the shared fixture `tally-ledger-path` (spec `bdk-spec-conformance`, Requirement "Eval cases of spec conformance in the review round"); it SHALL grade that both unleveled `spec-conformance` findings, the error message no delta lists and the `TALLY_LEDGER` path the code breaks, are leveled `blocker`.

The suite SHALL also hold the block case `judge-scenario-no-test`, tagged `block`, on the shared fixture `tally-total-untested` with round 1 holding three unleveled findings and no report, none naming its scenario: no test covers `tally total` without a ledger, nor `tally --help`, whose scenarios `Empty ledger` and `Help` the delta holds, part 01 lists and the code does; and no test covers `tally total` on negative amounts, which no scenario asks for. It SHALL grade that the first two are leveled `should-fix` and the third `nice-to-have`, that the round report is written, and that no project file was edited.

The suite SHALL also hold the block case `judge-e2e-failure`, tagged `block`, on the shared fixture `tally-broken-ledger`: `tally-change` plus a proposal line promising that `tally total` refuses a broken ledger, a delta that says so only for a ledger that is not valid JSON or not an array, a `design.md` that decides `total` does not check each entry, code that checks only that, and round 1 holding the E2E tester's verdict, two failed `break` path files and their two unleveled `e2e-check` findings (`["abc"]` crashes with a stack trace; `[true, 5]` prints `Total: 6.00` with exit 0). It SHALL grade that both findings are leveled `blocker`, that the round report is written, that no project file was edited, and that no tool call was denied.

The suite SHALL also hold the block case `review-integration-outside-fix-scope`, tagged `block`, on the `monthly-report` fixture with round 1 triaged (the parse bug of amounts with fewer than two decimals decided `accept`, a test gap decided `fix`), the fix pass committed (only `src/parse.test.js` changed) and round 2 recorded with `p03` and `integration` groups and an empty log. It SHALL grade that round 2's log holds a `review-integration` finding naming the cents and dollars seam with evidence saying it lies outside the fix scope, that no finding repeats the accepted parse bug, and that no project file was edited.

#### Scenario: Effect over no plugin

- **WHEN** the three cases run with and without the plugin, with the Bash grants the eval README names for them
- **THEN** each reports a positive `Δ`, and `review-integration-seam` passes the grader on the cents and dollars seam in the with-arm

#### Scenario: Instruction cases with the plugin

- **WHEN** `review-group-instruction` and `judge-instruction` run with the plugin, with the Bash grants the eval README names for the review cases
- **THEN** `review-group-instruction` passes its grader on the finding citing `CLAUDE.md`, and `judge-instruction` passes its `should-fix` and `not-a-problem` graders

#### Scenario: Earlier of two repeating findings kept

- **WHEN** `judge-previous-repeat` runs with the plugin, with the Bash grants the eval README names for the review cases
- **THEN** the latest level of the seeded finding is `blocker`, and the later finding's latest level is `not-a-problem` with a reason naming the seeded finding's id

#### Scenario: Spec conformance findings are blockers

- **WHEN** `judge-spec-conformance` runs with the plugin, with the Bash grants the eval README names for the review cases
- **THEN** both `spec-conformance` findings have the latest level `blocker`

#### Scenario: E2E failures are blockers

- **WHEN** `judge-e2e-failure` runs with the plugin, 3 times, with the Bash grants the eval README names for the review cases
- **THEN** in each run both `e2e-check` findings have the latest level `blocker`

#### Scenario: Scenario without a test levelled to be fixed

- **WHEN** `judge-scenario-no-test` runs with the plugin, 3 times, with the Bash grants the eval README names for the review cases
- **THEN** in each run the findings on `Empty ledger` and `Help` have the latest level `should-fix` and the negative-amounts finding `nice-to-have`

#### Scenario: Defect outside the fix scope is logged

- **WHEN** `review-integration-outside-fix-scope` runs with the plugin, with the Bash grants the eval README names for the review cases
- **THEN** it passes its graders: the seam finding outside the fix scope is in `round-2/findings.jsonl`, and no finding there repeats the accepted parse bug

