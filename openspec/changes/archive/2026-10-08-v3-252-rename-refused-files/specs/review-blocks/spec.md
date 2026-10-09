# Spec Delta

## MODIFIED Requirements

### Requirement: Round directory input

A block SHALL take the absolute path of a round directory `.bdk/runs/<change>/review/round-<N>/`, holding `groups.json` as `bdk git groups --record` writes it, and SHALL append to the log `findings.jsonl` in it. `review-group` SHALL also take a group id of `groups.json`. A block SHALL read the range and the group's files from `groups.json`, and the Change from `openspec/changes/<change>/` (`proposal.md`, `specs/`, `design.md`, `plan/parts/`), where `<change>` is the name of the run directory; a group `p<NN>` SHALL be reviewed against plan part `<NN>`.

Run alone without a round directory, a block SHALL use `.bdk/runs/manual/review/round-<N>/` with the lowest `N` whose directory holds no `review.md`, and, when it holds no `groups.json`, SHALL record the groups first with `bdk git groups <base> --rounds .bdk/runs/manual/review --record <round-dir>`, adding `--plan` with the plan parts of the one active Change when there is exactly one; `<base>` SHALL be the base the user gave, else the branch `origin/HEAD` names, else `main`. A standalone `review-group` without a group SHALL review every group except `integration`.

#### Scenario: Part group under a lead

- **WHEN** `review-group` runs with `.bdk/runs/monthly-report/review/round-1/` and group `p01`
- **THEN** it reviews the files of `p01` in `groups.json` over its `range`, against `openspec/changes/monthly-report/plan/parts/01.md`, and appends to `round-1/findings.jsonl`

#### Scenario: Standalone run records its own round

- **WHEN** `/bdk:review-group` runs without arguments on a branch and `.bdk/runs/manual/review/` does not exist
- **THEN** `.bdk/runs/manual/review/round-1/groups.json` is recorded first and the findings are appended to `.bdk/runs/manual/review/round-1/findings.jsonl`

### Requirement: Judge finishes the round

After every finding of the log has a level, the judge SHALL run `bdk findings report <log>`, which writes `review.md` in the round directory, and SHALL return the report's path and its counts line.

#### Scenario: Round finished

- **WHEN** the judge has leveled every finding of `round-1/findings.jsonl`
- **THEN** `round-1/review.md` exists, holds no finding under `## unleveled`, and the judge's reply names its path
