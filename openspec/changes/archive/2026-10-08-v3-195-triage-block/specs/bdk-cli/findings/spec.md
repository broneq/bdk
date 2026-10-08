## MODIFIED Requirements

### Requirement: Event log

A findings log SHALL be a UTF-8 text file of JSON Lines, where each line is one compact JSON object, an event, with a `type` field. Lines SHALL only ever be appended; no `bdk findings` command SHALL rewrite, reorder or remove a line. The events SHALL be:

| `type`     | Fields                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `finding`  | `id`, `source`, `summary`; optional `file`, `line` (a positive integer, only with `file`), `rule`, `evidence` |
| `level`    | `id`, `level` (`blocker`, `should-fix`, `nice-to-have` or `not-a-problem`); optional `reason`       |
| `decision` | `id`, `decision` (`fix`, `accept` or `defer`); `issue`, optional for `defer` and absent otherwise; optional `reason` |

`source` names the writer (for example `review-group`, `e2e-check`); every text field SHALL be a non-empty string. The log path SHALL be the first argument of every `bdk findings` command; by convention it is `<change>/review/round-N/findings.jsonl` in the run directory.

#### Scenario: One line per event

- **WHEN** `bdk findings add`, `bdk findings level` and `bdk findings decide` each run once on a log
- **THEN** the log holds three more lines than before, each one compact JSON object with the `type` `finding`, `level` and `decision`, and the earlier lines are byte-identical

#### Scenario: Decision line with an issue on a fix is skipped

- **WHEN** the log holds a `decision` line `fix` that carries an `issue`
- **THEN** `bdk findings list` skips that line and reports it by its line number

### Requirement: Record a decision

`bdk findings decide <log> <id> <decision> [--issue <ref>] [--reason <text>]` SHALL append one `decision` event. A decision outside `fix`, `accept` and `defer` SHALL be `usage/invalid-argument`. `--issue` SHALL be accepted only with `defer`, where it is optional: a `defer` without `--issue` defers the finding without a tracking issue (the auto-mode policy defers `nice-to-have` findings so); `--issue` with another decision SHALL be `usage/invalid-argument`. An unknown id SHALL be `usage/unknown-finding`, and nothing SHALL be appended.

#### Scenario: Defer without an issue

- **WHEN** `bdk findings decide <log> <id> defer --reason "nice-to-have"` runs without `--issue`
- **THEN** the log holds one more `decision` line with `defer` and no `issue`, and `bdk findings list` shows the finding decided `defer` without an issue

#### Scenario: Defer with an issue

- **WHEN** `bdk findings decide <log> <id> defer --issue "#42"` runs
- **THEN** the appended `decision` line holds the issue `#42`

#### Scenario: Issue on a fix

- **WHEN** `bdk findings decide <log> <id> fix --issue "#42"` runs
- **THEN** it reports `usage/invalid-argument`, exits 2, and the log is unchanged
