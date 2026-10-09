# Spec Delta

## MODIFIED Requirements

### Requirement: Round to triage

The block SHALL take a round directory `.bdk/runs/<change>/review/round-<N>/` holding `findings.jsonl` and `review.md`. Without one, it SHALL take the highest round of the Change the arguments name, else of `.bdk/runs/manual/review/`, among the rounds that hold `review.md`. It SHALL read the round with `bdk findings list <log>` and SHALL decide only the findings without a decision, so a decision already recorded stays. When a finding of the round has no level, the block SHALL decide nothing, name the unleveled findings, and say that the round needs the judge first.

#### Scenario: Unleveled round

- **WHEN** `/bdk:triage` runs on a round whose log holds a finding without a `level` event
- **THEN** it appends no `decision` line and its reply names that finding and the judge

#### Scenario: Resumed triage

- **WHEN** a round holds four leveled findings, two of them already decided, and triage runs on it
- **THEN** it records decisions for the other two only

### Requirement: Decisions recorded through the CLI

Every decision SHALL be appended with `bdk findings decide <log> <id> <decision>` and a `--reason`, never by editing the log: in auto mode a reason naming `policy.gates.review auto` and the level, in manual mode a reason saying the user chose it, with the user's note when there is one. A `defer` with an issue SHALL pass the issue reference with `--issue`. After the decisions the block SHALL run `bdk findings report <log>` so `review.md` shows them, and SHALL reply with the report path, the count per decision, and the id and summary of each finding decided `fix`.

#### Scenario: Report refreshed

- **WHEN** triage has recorded the decisions of a round
- **THEN** `review.md` of the round lists each decision under its finding, and the reply names the findings to fix
