## MODIFIED Requirements

### Requirement: Levels by the product's behaviour

The judge SHALL judge every finding of the log that has no level, once each: it SHALL check the failure scenario against the code at the finding's place and set one level with `bdk findings level` and a one-sentence `--reason`, by these definitions:

| Level | When |
|---|---|
| `blocker` | the product breaks a spec scenario or the intent of the Change; the spec deltas would not describe the product after archive (a `spec-conformance` finding whose problem holds); a check is red; a security hole; data loss; a regression of existing behaviour |
| `should-fix` | the product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost that the finding names |
| `nice-to-have` | an improvement whose absence costs nothing concrete |
| `not-a-problem` | the failure scenario does not hold, the finding is out of the Change's scope or already handled, or it repeats an earlier finding of the log, whose id the reason names |

Of two findings that repeat each other, the judge SHALL level the later one in the log `not-a-problem` and judge the earlier one on its own. A rule violation by itself SHALL NOT be a `blocker`. For a `spec-conformance` finding the judge SHALL check both sides: what the cited spec location says, and what the code does for the input the evidence names; the finding holds when they disagree, and `/bdk:close` would refuse to archive the Change while it is open. The judge SHALL add no finding, record no decision, and leave a finding that already has a level as it is.

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

### Requirement: Eval cases of the review blocks

The suite SHALL hold the block cases `review-group-logic-bug`, `review-integration-seam` and `judge-levels`, tagged `block`, built from the shared fixture `monthly-report`: a configured BDK project whose branch carries a Change of two plan parts, with a logic bug inside part 01 and a seam bug between parts 01 and 02 that every test of the parts misses, and a recorded round 1. Each case SHALL grade the findings log, check that no project file was edited, and show the block fired. Run with and without the plugin, each case SHALL report a with-arm score above the without-arm score, and the `review-integration-seam` case SHALL pass its seam grader with the plugin.

The suite SHALL also hold the block cases `review-group-instruction` and `judge-instruction`, tagged `block`, built from the shared fixture `monthly-report-instructions`: the `monthly-report` fixture with a `CLAUDE.md` on `main` holding an instruction that part 01 breaks. `review-group-instruction` SHALL grade a `review-group` finding citing `CLAUDE.md`; `judge-instruction` SHALL grade the level `should-fix` for a finding that cites the broken instruction and `not-a-problem` for a finding that cites an instruction `CLAUDE.md` does not hold.

The suite SHALL also hold the block case `judge-previous-repeat`, tagged `block`, on the `monthly-report` fixture with a log holding a seeded `previous-review` finding of the parse bug and, after it, a `review-group` finding of the same bug worded differently; it SHALL grade that the seeded finding is `blocker` and never `not-a-problem`, and that the later finding is `not-a-problem` with a reason naming the seeded finding's id.

The suite SHALL also hold the block case `judge-spec-conformance`, tagged `block`, on the shared fixture `tally-ledger-path` (spec `bdk-spec-conformance`, Requirement "Eval cases of spec conformance in the review round"); it SHALL grade that both unleveled `spec-conformance` findings, the error message no delta lists and the `TALLY_LEDGER` path the code breaks, are leveled `blocker`.

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
