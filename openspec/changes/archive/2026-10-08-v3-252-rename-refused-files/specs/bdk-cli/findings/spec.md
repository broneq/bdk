# Spec Delta

## MODIFIED Requirements

### Requirement: Round report

`bdk findings report <log>` SHALL fold the log as `bdk findings list` does and write the result as Markdown to `review.md` in the log's directory, replacing an earlier `review.md`, and print the report's path and the counts line (under `--json`: `{"report": <path>, "counts": <the counts of list>}`). The report SHALL be a pure function of the log text: a heading line `# Review round report`, the counts line in the form `list` prints it, then the sections `## blocker`, `## should-fix`, `## nice-to-have`, `## not-a-problem` and `## unleveled`, always all five and in this order. Each section SHALL list its findings in fold order, one item per finding holding the id, the place (`file`, `file:line` or `-`), the rule in brackets when the finding has one, the summary and the sources, followed by indented lines for the evidence, the level reason, the decision with its issue and the decision reason, each only when present; a section without findings SHALL hold the line `None.`. Lines the fold skipped SHALL follow under `## Skipped lines`, one per line with its number and reason, and that section SHALL be left out when no line was skipped. The command SHALL write the report whatever the levels are. A log that does not exist in an existing directory SHALL give a report of zero findings; a log whose directory does not exist SHALL be `env/log-dir-missing`, exit 3, and nothing SHALL be written.

#### Scenario: Report of a judged round

- **WHEN** a log in `round-1/` holds a finding leveled `blocker` with a reason and a finding leveled `not-a-problem`, and `bdk findings report round-1/findings.jsonl` runs
- **THEN** `round-1/review.md` exists, its `## blocker` section lists the first finding with its level reason, its `## not-a-problem` section lists the second, the other three sections hold `None.`, stdout names the report path, and the exit code is 0

#### Scenario: Same log, same report

- **WHEN** `bdk findings report <log>` runs twice on an unchanged log
- **THEN** both runs leave a byte-identical `review.md`

#### Scenario: Report replaces an earlier one

- **WHEN** `review.md` exists from an earlier run, a level event is appended, and `bdk findings report <log>` runs again
- **THEN** `review.md` shows the new level and nothing of the earlier file remains

#### Scenario: Round without findings

- **WHEN** `round-2/` exists without `findings.jsonl` and `bdk findings report round-2/findings.jsonl --json` runs
- **THEN** `round-2/review.md` holds every section with `None.`, the result's `counts.findings` is 0, and the exit code is 0

#### Scenario: Missing round directory

- **WHEN** `bdk findings report runs/c/review/round-9/findings.jsonl` runs and `round-9/` does not exist
- **THEN** it reports `env/log-dir-missing`, exits 3, and no file is written
