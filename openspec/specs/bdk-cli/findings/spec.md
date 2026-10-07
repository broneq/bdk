# bdk-cli/findings Specification

## Purpose

The `bdk findings` command group: the event log in which the writers of a review round record findings, levels and decisions without rewriting each other's lines, and the fold that turns the log into the current list of findings.

## Requirements

### Requirement: Event log

A findings log SHALL be a UTF-8 text file of JSON Lines, where each line is one compact JSON object, an event, with a `type` field. Lines SHALL only ever be appended; no `bdk findings` command SHALL rewrite, reorder or remove a line. The events SHALL be:

| `type`     | Fields                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `finding`  | `id`, `source`, `summary`; optional `file`, `line` (a positive integer, only with `file`), `rule`, `evidence` |
| `level`    | `id`, `level` (`blocker`, `should-fix`, `nice-to-have` or `not-a-problem`); optional `reason`       |
| `decision` | `id`, `decision` (`fix`, `accept` or `defer`); `issue`, required for `defer` and absent otherwise; optional `reason` |

`source` names the writer (for example `review-group`, `e2e-check`); every text field SHALL be a non-empty string. The log path SHALL be the first argument of every `bdk findings` command; by convention it is `<change>/review/round-N/findings.jsonl` in the run directory.

#### Scenario: One line per event

- **WHEN** `bdk findings add`, `bdk findings level` and `bdk findings decide` each run once on a log
- **THEN** the log holds three more lines than before, each one compact JSON object with the `type` `finding`, `level` and `decision`, and the earlier lines are byte-identical

### Requirement: Finding id and dedupe key

The CLI SHALL stamp the `id` of a finding; it SHALL NOT take it as input. The id SHALL be `f-` followed by the first 12 hexadecimal characters of the SHA-256 of the dedupe key, so two findings with the same dedupe key get the same id. The dedupe key SHALL be the `file`, the `line` and the rule part, joined by the character U+001F, where an absent `file` or `line` is the empty string and the rule part is `rule:` followed by the `rule` when a rule is given, otherwise `summary:` followed by the normalised summary. The normalised summary SHALL be the summary in Unicode NFKC, lowercased, with every run of characters that are neither letters nor digits replaced by one space, and trimmed.

#### Scenario: Same rule on the same line

- **WHEN** two writers add a finding on `src/a.ts` line 12 with rule `no-any` and different summaries
- **THEN** both `add` calls print the same id

#### Scenario: Same summary without a rule

- **WHEN** two writers add a finding on `src/a.ts` without a rule, with the summaries `Missing null check!` and `missing  null check`
- **THEN** both `add` calls print the same id

#### Scenario: Different rule

- **WHEN** two findings on the same file and line name different rules
- **THEN** their ids differ

### Requirement: Add a finding

`bdk findings add <log> --source <source> --summary <summary> [--file <path>] [--line <n>] [--rule <rule>] [--evidence <text>]` SHALL append one `finding` event and print the finding id (under `--json`: `{"id": ...}`). It SHALL create the log and its missing parent directories. A missing `--source` or `--summary` SHALL be `usage/missing-argument`; a `--line` that is not a positive integer, or a `--line` without `--file`, SHALL be `usage/invalid-argument`. Adding a finding whose id is already in the log SHALL append the event all the same.

#### Scenario: First finding of a round

- **WHEN** `bdk findings add .bdk/runs/c/review/round-1/findings.jsonl --source review-group --summary "x" --file src/a.ts --line 3` runs and `round-1/` does not exist
- **THEN** the directory and the log are created, the log holds one `finding` line, stdout is the id, and the exit code is 0

#### Scenario: Line without a file

- **WHEN** `bdk findings add <log> --source s --summary x --line 3` runs
- **THEN** it reports `usage/invalid-argument`, exits 2, and the log is unchanged

### Requirement: Parallel writers lose no line

Every `add`, `level` and `decide` call SHALL write its event with one append of one whole line to the log opened in append mode, so that calls running at the same time on the same log neither overwrite nor interleave each other's lines.

#### Scenario: Parallel add calls

- **WHEN** 50 `bdk findings add` processes with distinct findings run at the same time on one log
- **THEN** the log holds exactly 50 lines, each of them valid JSON, and `bdk findings list` counts 50 findings

### Requirement: Set a level

`bdk findings level <log> <id> <level> [--reason <text>]` SHALL append one `level` event. A level outside `blocker`, `should-fix`, `nice-to-have` and `not-a-problem` SHALL be `usage/invalid-argument`. An id that no `finding` event in the log carries SHALL be `usage/unknown-finding`, and nothing SHALL be appended.

#### Scenario: Unknown id

- **WHEN** `bdk findings level <log> f-000000000000 blocker` runs and no finding in the log has that id
- **THEN** it reports `usage/unknown-finding`, exits 2, and the log is unchanged

### Requirement: Record a decision

`bdk findings decide <log> <id> <decision> [--issue <ref>] [--reason <text>]` SHALL append one `decision` event. A decision outside `fix`, `accept` and `defer` SHALL be `usage/invalid-argument`; `defer` without `--issue`, or `--issue` with another decision, SHALL be `usage/invalid-argument`. An unknown id SHALL be `usage/unknown-finding`, and nothing SHALL be appended.

#### Scenario: Defer without an issue

- **WHEN** `bdk findings decide <log> <id> defer` runs without `--issue`
- **THEN** it reports `usage/invalid-argument`, exits 2, and the log is unchanged

### Requirement: Fold the log

`bdk findings list <log> [--level <level|unleveled>] [--decision <decision|undecided>]` SHALL fold the log into one entry per finding id, in the order of each id's first `finding` line. The entry SHALL hold the fields of the first `finding` event of that id, the `sources` of all its `finding` events in order of first appearance without repeats, the number of its `finding` events as `reports`, and the `level`, `decision`, `issue` and `reason`s of the last `level` and the last `decision` event of that id in file order, or none. The result SHALL hold counts over all findings (total, per level including unleveled, per decision including undecided) and the findings that match the filters; `--decision fix` lists what to fix. A line that is not valid JSON, does not match an event schema, or names an id without a `finding` event SHALL be skipped and reported with its line number and reason; it SHALL NOT fail the command. A log that does not exist in an existing directory SHALL fold to zero findings; a log whose directory does not exist SHALL be `env/log-dir-missing`, exit 3. The command SHALL exit 0 whatever it lists.

#### Scenario: Latest level and decision win

- **WHEN** the log holds a finding, then the levels `should-fix` and `blocker` and the decisions `defer` (issue `#9`) and `fix` for its id
- **THEN** `bdk findings list <log>` shows that finding with level `blocker` and decision `fix` and no issue

#### Scenario: Duplicates fold into one finding

- **WHEN** `review-group` and `review-integration` each add a finding with the same dedupe key
- **THEN** `list` shows one finding with `sources` `review-group`, `review-integration` and `reports` 2, and counts one finding

#### Scenario: What to fix

- **WHEN** a log holds three findings, one decided `fix`, one `accept` and one undecided
- **THEN** `bdk findings list <log> --decision fix` lists only the first, and the counts still report three findings, one per decision value and one undecided

#### Scenario: Damaged line

- **WHEN** the log holds a truncated line between two valid findings
- **THEN** `list` shows both findings, reports the truncated line by its number as skipped, and exits 0

#### Scenario: No log yet

- **WHEN** `bdk findings list` runs on `round-1/findings.jsonl` and `round-1/` exists without the file
- **THEN** the result counts zero findings and the exit code is 0
