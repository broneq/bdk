## ADDED Requirements

### Requirement: Run cap and probe

Every session of a suite SHALL be capped by `--run-cap` (default 15 USD), passed to the provider as the session's `max_budget_usd`. No cap SHALL span runs, series or suites: a series runs every run it plans. `--probe` SHALL run one run per cell, then print the measured cost per cell and the projected cost of the full series, and start no further run.

#### Scenario: run cap

- **WHEN** `pnpm eval stages --skill execute --run-cap 8` starts a session
- **THEN** the session's `max_budget_usd` is 8, and a run that reports no cost is counted at 8 USD and discarded

#### Scenario: no cap across runs

- **WHEN** earlier series spent any amount
- **THEN** a new series or probe starts all its runs

#### Scenario: probe projection

- **WHEN** `pnpm eval execute-ab --probe` finishes
- **THEN** it prints each cell's cost and the projected cost of the full series with the configured runs per cell, and no further run starts

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

## REMOVED Requirements

### Requirement: Budget stop and probe

**Reason**: The ledger summed every run since the harness existed, so it stopped every suite once the sum passed 100 USD and each later probe needed `--budget` raised by hand. The decision to spend sits with the probe's projection and the user's approval of it, and a runaway session is stopped by its own run cap.
**Migration**: Drop `--budget` from `pnpm eval` commands; `evals/.runs/budget.json` is no longer read or written and can be deleted. The probe and its projection are kept in "Run cap and probe".
