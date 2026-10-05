## ADDED Requirements

### Requirement: Stage probes count refusals from the run journal

After each run of the `stages` suite, the harness SHALL run `bdk diagnostics report --session <id> --json` in the run's fixture working directory and SHALL take `refusals` and `refusal:<rule>` of the results row from that report, so a probe row and a production report count refusals the same way. The count from the Bash tool results of the transcript SHALL stay in the row as `refusals-transcript`, and `pnpm eval report stages` SHALL name every run where the two totals differ.

The report covers every rule class, `guard`, `state` and `kernel` included, and counts guard blocks once in `guardBlocks`, not under `refusals`. A run whose report fails (no journal, a kernel error) keeps the transcript count in `refusals` and is marked with the metric `journal-missing: 1`.

#### Scenario: journal counts in the row

- **WHEN** `pnpm eval stages --skill execute --probe` finishes a run whose agents met three `policy/missing-evidence` refusals
- **THEN** the row holds `refusal:policy/missing-evidence: 3` taken from the report, and `refusals-transcript`

#### Scenario: totals differ

- **WHEN** a row's `refusals` and `refusals-transcript` differ
- **THEN** `pnpm eval report stages` lists the run with both totals

#### Scenario: no journal

- **WHEN** the fixture of a run holds no journal
- **THEN** the row's `refusals` is the transcript count and `journal-missing` is 1
