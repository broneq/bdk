# Spec Delta

## ADDED Requirements

### Requirement: No run file named like a refused report

No file that a skill, an agent or the CLI of the `bdk` plugin writes SHALL have a base name matching `^(REPORT|SUMMARY|FINDINGS|ANALYSIS).*\.md$`, compared without regard to case: Claude Code refuses a subagent's `Write` to such a file ("Subagents should return findings as text, not write report files"), and every BDK block may run as a subagent. A test of the plugin SHALL fail when a Markdown file name in the text of `skills/`, `agents/` or the CLI source outside its tests matches the pattern.

#### Scenario: Plugin text names no refused file

- **WHEN** the plugin's tests run on a clean checkout
- **THEN** the check of file names passes, and no file name in `skills/`, `agents/` or `src/` outside its tests matches the pattern

#### Scenario: A refused name is caught

- **WHEN** a skill's text names `execute/summary.md` or `review/round-1/Report.md` as a file it writes
- **THEN** the check fails and names the skill file and the file name

#### Scenario: Review round eval writes its record

- **WHEN** the orchestrator case `auto-review-first-round` runs, where the round runs in a `bdk:lead` subagent and the judge in a subagent under it
- **THEN** `.bdk/runs/monthly-report/review/round-1/review.md` exists after the run
