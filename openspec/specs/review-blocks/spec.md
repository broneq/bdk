# review-blocks Specification

## Purpose

The review blocks of the `bdk` plugin: `review-group`, `review-integration` and `judge`, the agents that preload them, what each reads and writes in a review round, the levels the judge sets, and their eval cases.

## Requirements

### Requirement: Review blocks and their agents

The `bdk` plugin SHALL ship three block skills, each preloaded by its own agent through the agent's `skills:` field, so that a caller starts a block with one `Agent` call and a user runs it alone as `/bdk:<block>`:

| Skill | Agent | Default model | Job |
|---|---|---|---|
| `review-group` | `bdk:reviewer` | sonnet | finds problems inside one group of files of a round |
| `review-integration` | `bdk:integration-reviewer` | opus | finds problems of the whole Change and between its parts |
| `judge` | `bdk:judge` | sonnet | sets the level of every finding and writes the round report |

No agent of the three SHALL have the `Write` or `Edit` tool, and no block SHALL change a project file, commit, or start another agent. Each block SHALL start with a `!` block running `bdk config show` and SHALL stop with the line "BDK not configured: run /bdk:setup" when it reports the project unconfigured.

#### Scenario: A lead starts a block

- **WHEN** a lead calls `Agent` with `subagent_type` `bdk:reviewer` and a prompt naming a round directory and group `p01`
- **THEN** the agent follows the `review-group` skill without a `Skill` call and returns after appending its findings

#### Scenario: Not configured

- **WHEN** `/bdk:judge` runs in a project without `.bdk/settings.yaml`
- **THEN** it reports "BDK not configured: run /bdk:setup" and writes nothing

### Requirement: Round directory input

A block SHALL take the absolute path of a round directory `.bdk/runs/<change>/review/round-<N>/`, holding `groups.json` as `bdk git groups --record` writes it, and SHALL append to the log `findings.jsonl` in it. `review-group` SHALL also take a group id of `groups.json`. A block SHALL read the range and the group's files from `groups.json`, and the Change from `openspec/changes/<change>/` (`proposal.md`, `specs/`, `design.md`, `plan/parts/`), where `<change>` is the name of the run directory; a group `p<NN>` SHALL be reviewed against plan part `<NN>`.

Run alone without a round directory, a block SHALL use `.bdk/runs/manual/review/round-<N>/` with the lowest `N` whose directory holds no `review.md`, and, when it holds no `groups.json`, SHALL record the groups first with `bdk git groups <base> --rounds .bdk/runs/manual/review --record <round-dir>`, adding `--plan` with the plan parts of the one active Change when there is exactly one; `<base>` SHALL be the base the user gave, else the branch `origin/HEAD` names, else `main`. A standalone `review-group` without a group SHALL review every group except `integration`.

#### Scenario: Part group under a lead

- **WHEN** `review-group` runs with `.bdk/runs/monthly-report/review/round-1/` and group `p01`
- **THEN** it reviews the files of `p01` in `groups.json` over its `range`, against `openspec/changes/monthly-report/plan/parts/01.md`, and appends to `round-1/findings.jsonl`

#### Scenario: Standalone run records its own round

- **WHEN** `/bdk:review-group` runs without arguments on a branch and `.bdk/runs/manual/review/` does not exist
- **THEN** `.bdk/runs/manual/review/round-1/groups.json` is recorded first and the findings are appended to `.bdk/runs/manual/review/round-1/findings.jsonl`

### Requirement: Findings written through the CLI

Every problem a reviewer finds SHALL be appended as one `finding` event with `bdk findings add`, never by editing the log, with `--source` `review-group` or `review-integration`, the `--file` and `--line` where the problem is, a one-line `--summary`, and an `--evidence` that states the failure scenario: the input and the wrong result, or the change that breaks the behaviour while every test passes. `--rule` SHALL be given only with a rule id that `bdk rules for --stage review` printed for the reviewed files, or with the path of a project instruction file the reviewer read, relative to the project root, as the Requirement "Project instructions in the review" says. A reviewer SHALL run no test, linter or build, and SHALL set no level and no decision.

#### Scenario: Finding with a failure scenario

- **WHEN** `review-group` finds that `parseEntries` turns the amount `7` into 7 cents
- **THEN** the log gains a `finding` line with `source` `review-group`, `file` `src/parse.js`, a line number, and evidence naming the input `7` and the wrong result

#### Scenario: Finding that cites an instruction file

- **WHEN** `review-group` finds a changed line of `src/parse.test.js` that breaks an instruction of the project's `CLAUDE.md`
- **THEN** the finding's `rule` is `CLAUDE.md` and its evidence quotes the instruction

### Requirement: Group review

`review-group` SHALL review each file of its group whole, with its diff over the range and the tests that cover it, for: behaviour against the plan part's tasks and the spec scenarios they name, logic errors, tests that cannot fail or are missing for a changed behaviour, the rules `bdk rules for --stage review --files <file>...` prints for the group's files, and security at trust boundaries. A problem it can only see with a file outside its group SHALL be left to `review-integration`.

#### Scenario: Logic bug inside a part

- **WHEN** `review-group` reviews group `p01` of the `monthly-report` fixture, where `parseEntries` drops the decimal point and the part's tests use only two-decimal amounts
- **THEN** the log holds a `review-group` finding on `src/parse.js` whose summary or evidence names amounts with fewer than two decimals

### Requirement: Integration review

`review-integration` SHALL run after the group reviews of its round and review the Change top down: each scenario of the Change's spec deltas reached by the product as a user runs it, from its entry point to the code that makes it true; a test for each scenario at the level that proves it; behaviour no scenario or intent names; each contract a part changes (an exported function or type, a field and its unit, empty and null values, an error contract, a configuration key, a file format, a command) against every user of it in other parts and outside the Change; changed files no plan part lists. It SHALL read the findings already in the log and SHALL NOT add a finding that repeats one of them. A seam finding SHALL be placed where the wrong assumption is and name the other side in its evidence.

#### Scenario: Seam bug between parts

- **WHEN** `review-integration` reviews round 1 of the `monthly-report` fixture, where part 01 returns amounts in cents and part 02 formats them as dollars while each part's tests pass
- **THEN** the log holds a `review-integration` finding that names the cents and dollars mismatch between `src/parse.js` and `src/report.js`

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

### Requirement: Project instructions in the review

`review-group` SHALL read the project instructions that bind each file of its group: `CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to the file, and each `.claude/rules/*.md` whose `paths` match the file or that has no `paths`; with `--workdir`, the ones under the work directory. It SHALL report each changed line that breaks one of them as a finding whose `--rule` is the path of the instruction file relative to the project root (`CLAUDE.md`, `src/AGENTS.md`, `.claude/rules/testing.md`) and whose evidence quotes the instruction.

The judge SHALL read the instruction file a finding cites with such a path, and SHALL check that the instruction the evidence quotes is in that file and binds the finding's file. A broken instruction that holds SHALL be levelled `should-fix` at most, as a broken rule is; a finding whose cited instruction is not in the file, or does not bind the finding's file, SHALL be `not-a-problem`.

`review-integration` SHALL NOT be required to read the project instructions.

#### Scenario: Change breaks an instruction of CLAUDE.md

- **WHEN** `review-group` reviews group `p01` of the `monthly-report-instructions` fixture, whose `CLAUDE.md` asks that the tests of each exported function be grouped in a `describe` block named after it, and `src/parse.test.js` calls `test` with no `describe`
- **THEN** the log holds a `review-group` finding on `src/parse.test.js` with `rule` `CLAUDE.md`

#### Scenario: Judge levels a broken instruction

- **WHEN** the judge runs on a log holding that finding, citing `CLAUDE.md`
- **THEN** its latest level is `should-fix`

#### Scenario: Cited instruction that the file does not hold

- **WHEN** the judge runs on a finding citing `CLAUDE.md` for an instruction that `CLAUDE.md` does not hold
- **THEN** its latest level is `not-a-problem`

#### Scenario: Instructions of another checkout

- **WHEN** `review-group` runs with `--workdir /p/.bdk/runs/pr-7/worktree` and the worktree holds `src/AGENTS.md`
- **THEN** it reads `/p/.bdk/runs/pr-7/worktree/CLAUDE.md` and `/p/.bdk/runs/pr-7/worktree/src/AGENTS.md` for the files under `src/`, not the instruction files of the working directory

### Requirement: Judge finishes the round

After every finding of the log has a level, the judge SHALL run `bdk findings report <log>`, which writes `review.md` in the round directory, and SHALL return the report's path and its counts line.

#### Scenario: Round finished

- **WHEN** the judge has leveled every finding of `round-1/findings.jsonl`
- **THEN** `round-1/review.md` exists, holds no finding under `## unleveled`, and the judge's reply names its path

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

### Requirement: Review of another checkout and intent

`review-group`, `review-integration` and `judge` SHALL take three optional inputs, so that a caller can review code that is not the working directory's checkout:

- `--workdir <path>`: the checkout to review. The block SHALL read every file, the plan part and the Change under that path, run git as `git -C <path>`, and run `bdk` as `cd <path> && <bdk command>`; it SHALL still append to the log of the round directory it was given.
- `--change <path>`: the Change directory, relative to the work directory, archived or not (`openspec/changes/archive/<date>-<name>/`), used instead of `openspec/changes/<run directory name>/`. `--change none` SHALL mean the range carries no Change.
- `--intent <file>`: a file stating the intent of the reviewed range (a pull request's title, description and linked issues). The block SHALL read it as part of the contract, next to the Change when there is one, and in place of it when there is none.

Without these inputs a block SHALL behave as the Requirement "Round directory input" says.

#### Scenario: Pull request reviewed in its worktree

- **WHEN** `review-group` runs with the round `/p/.bdk/runs/pr-7/review/round-1`, group `p01`, `--workdir /p/.bdk/runs/pr-7/worktree`, `--change openspec/changes/monthly-report` and `--intent /p/.bdk/runs/pr-7/pr.md`
- **THEN** it reads `src/parse.js` and `openspec/changes/monthly-report/plan/parts/01.md` under the worktree, and appends its findings to `/p/.bdk/runs/pr-7/review/round-1/findings.jsonl`

#### Scenario: Range without a Change

- **WHEN** the judge runs with `--change none` and `--intent <brief>`
- **THEN** it sets the levels by the intent the brief states, and reads no `openspec/changes/` directory

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
