## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Findings written through the CLI

Every problem a reviewer finds SHALL be appended as one `finding` event with `bdk findings add`, never by editing the log, with `--source` `review-group` or `review-integration`, the `--file` and `--line` where the problem is, a one-line `--summary`, and an `--evidence` that states the failure scenario: the input and the wrong result, or the change that breaks the behaviour while every test passes. `--rule` SHALL be given only with a rule id that `bdk rules for --stage review` printed for the reviewed files, or with the path of a project instruction file the reviewer read, relative to the project root, as the Requirement "Project instructions in the review" says. A reviewer SHALL run no test, linter or build, and SHALL set no level and no decision.

#### Scenario: Finding with a failure scenario

- **WHEN** `review-group` finds that `parseEntries` turns the amount `7` into 7 cents
- **THEN** the log gains a `finding` line with `source` `review-group`, `file` `src/parse.js`, a line number, and evidence naming the input `7` and the wrong result

#### Scenario: Finding that cites an instruction file

- **WHEN** `review-group` finds a changed line of `src/parse.test.js` that breaks an instruction of the project's `CLAUDE.md`
- **THEN** the finding's `rule` is `CLAUDE.md` and its evidence quotes the instruction

### Requirement: Eval cases of the review blocks

The suite SHALL hold the block cases `review-group-logic-bug`, `review-integration-seam` and `judge-levels`, tagged `block`, built from the shared fixture `monthly-report`: a configured BDK project whose branch carries a Change of two plan parts, with a logic bug inside part 01 and a seam bug between parts 01 and 02 that every test of the parts misses, and a recorded round 1. Each case SHALL grade the findings log, check that no project file was edited, and show the block fired. Run with and without the plugin, each case SHALL report a with-arm score above the without-arm score, and the `review-integration-seam` case SHALL pass its seam grader with the plugin.

The suite SHALL also hold the block cases `review-group-instruction` and `judge-instruction`, tagged `block`, built from the shared fixture `monthly-report-instructions`: the `monthly-report` fixture with a `CLAUDE.md` on `main` holding an instruction that part 01 breaks. `review-group-instruction` SHALL grade a `review-group` finding citing `CLAUDE.md`; `judge-instruction` SHALL grade the level `should-fix` for a finding that cites the broken instruction and `not-a-problem` for a finding that cites an instruction `CLAUDE.md` does not hold.

#### Scenario: Effect over no plugin

- **WHEN** the three cases run with and without the plugin, with the Bash grants the eval README names for them
- **THEN** each reports a positive `Δ`, and `review-integration-seam` passes the grader on the cents and dollars seam in the with-arm

#### Scenario: Instruction cases with the plugin

- **WHEN** `review-group-instruction` and `judge-instruction` run with the plugin, with the Bash grants the eval README names for the review cases
- **THEN** `review-group-instruction` passes its grader on the finding citing `CLAUDE.md`, and `judge-instruction` passes its `should-fix` and `not-a-problem` graders
