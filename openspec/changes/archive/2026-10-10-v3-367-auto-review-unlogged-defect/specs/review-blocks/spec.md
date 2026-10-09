## MODIFIED Requirements

### Requirement: Fix parts and fix rounds

A group `p<NN>` whose part `openspec/changes/<change>/plan/parts/<NN>.md` does not exist SHALL be reviewed against the fix part `<run dir>/review/round-<k>/fixes/parts/<NN>.md` of the run directory. When the round's `groups.json` has an anchor of `kind` `round`, the round reviews the fixes made since that round: `review-group` SHALL check, for each task of a fix part, that the failure scenario of the finding the task names (read from that earlier round's log) no longer holds, and SHALL add a finding when it still holds; `review-integration` SHALL check only the scenarios and contracts that the round's changed files reach, following each changed contract to its users, instead of every scenario of the Change.

A problem `review-integration` sees in such a round in code outside the round's files, while it follows a scenario or a contract, SHALL be appended to the round's log like any other finding, with evidence that says it lies outside the fix scope; the judge levels it and triage decides it. `review-integration` SHALL NOT search the code outside the scope for such problems. It SHALL read the logs of every earlier round of the Change and SHALL NOT add a finding that repeats a finding of one of them, whatever that finding's level or decision. Its return SHALL name only the findings it appended, and SHALL NOT describe a problem it did not append.

#### Scenario: Fixed finding still holds

- **WHEN** round 2 of `monthly-report` is anchored on round 1, group `p03` has the fix part `round-1/fixes/parts/03.md` whose task names finding `f-9ffca2edd413`, and `parseEntries('7')` still gives 7
- **THEN** `review-group` appends a finding on `src/parse.js` whose evidence names `f-9ffca2edd413` and the input `7`

#### Scenario: Integration in a fix round

- **WHEN** round 2 is anchored on round 1 and its files are `src/parse.js` and `src/parse.test.js`
- **THEN** `review-integration` checks the scenarios that reach `parseEntries` and the users of its result, and does not review the scenarios of `ledger --help`

#### Scenario: Defect outside the fix scope

- **WHEN** round 2 of `monthly-report` is anchored on round 1, its only file is `src/parse.test.js`, and while following `parseEntries` to its users `review-integration` sees that `src/report.js` formats the cents of `src/parse.js` as dollars, which no finding of round 1 or round 2 names
- **THEN** `round-2/findings.jsonl` holds a `review-integration` finding naming that mismatch, whose evidence says it lies outside the fix scope, and the return names its id

#### Scenario: A decided finding is not raised again

- **WHEN** round 1 holds finding `f-9ffca2edd413` (`parseEntries('7')` gives 7) decided `accept`, and round 2 is anchored on round 1 with only `src/parse.test.js` in its scope
- **THEN** `review-integration` appends no finding to `round-2/findings.jsonl` on the parsing of amounts with fewer than two decimals

### Requirement: Eval cases of the review blocks

The suite SHALL hold the block cases `review-group-logic-bug`, `review-integration-seam` and `judge-levels`, tagged `block`, built from the shared fixture `monthly-report`: a configured BDK project whose branch carries a Change of two plan parts, with a logic bug inside part 01 and a seam bug between parts 01 and 02 that every test of the parts misses, and a recorded round 1. Each case SHALL grade the findings log, check that no project file was edited, and show the block fired. Run with and without the plugin, each case SHALL report a with-arm score above the without-arm score, and the `review-integration-seam` case SHALL pass its seam grader with the plugin.

The suite SHALL also hold the block cases `review-group-instruction` and `judge-instruction`, tagged `block`, built from the shared fixture `monthly-report-instructions`: the `monthly-report` fixture with a `CLAUDE.md` on `main` holding an instruction that part 01 breaks. `review-group-instruction` SHALL grade a `review-group` finding citing `CLAUDE.md`; `judge-instruction` SHALL grade the level `should-fix` for a finding that cites the broken instruction and `not-a-problem` for a finding that cites an instruction `CLAUDE.md` does not hold.

The suite SHALL also hold the block case `judge-previous-repeat`, tagged `block`, on the `monthly-report` fixture with a log holding a seeded `previous-review` finding of the parse bug and, after it, a `review-group` finding of the same bug worded differently; it SHALL grade that the seeded finding is `blocker` and never `not-a-problem`, and that the later finding is `not-a-problem` with a reason naming the seeded finding's id.

The suite SHALL also hold the block case `judge-spec-conformance`, tagged `block`, on the shared fixture `tally-ledger-path` (spec `bdk-spec-conformance`, Requirement "Eval cases of spec conformance in the review round"); it SHALL grade that both unleveled `spec-conformance` findings, the error message no delta lists and the `TALLY_LEDGER` path the code breaks, are leveled `blocker`.


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

#### Scenario: Defect outside the fix scope is logged

- **WHEN** `review-integration-outside-fix-scope` runs with the plugin, with the Bash grants the eval README names for the review cases
- **THEN** it passes its graders: the seam finding outside the fix scope is in `round-2/findings.jsonl`, and no finding there repeats the accepted parse bug
