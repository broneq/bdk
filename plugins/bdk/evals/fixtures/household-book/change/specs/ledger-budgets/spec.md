## Purpose

Lets a household set a monthly spending limit per category and see how much of it a month has used.

## ADDED Requirements

### Requirement: Budgets

`ledger budget set <category> <amount>` SHALL set the monthly limit of a category, replacing an earlier one, and print `Budget <category> <amount>`, the amount with two decimals. A category the book does not hold SHALL print `ledger: no category <name>` to stderr and exit 2; an amount that is not above zero SHALL print `ledger: budget must be positive` and exit 2. A missing or unknown subcommand SHALL print `ledger: budget needs one of list, set` and exit 2.

#### Scenario: Set a budget

- **WHEN** the book holds the category `food` and `ledger budget set food 300` runs
- **THEN** it prints `Budget food 300.00`

#### Scenario: Replace a budget

- **WHEN** `ledger budget set food 300` and then `ledger budget set food 250` run
- **THEN** `ledger budget list` prints one line for `food`, with the limit `250.00`

#### Scenario: Budget for an unknown category

- **WHEN** `ledger budget set travel 100` runs and the book has no category `travel`
- **THEN** it prints `ledger: no category travel` to stderr and exits 2

### Requirement: Budget status

`ledger budget list [--month <YYYY-MM>]` SHALL print, for the month (the month of today when not given), one line per budget in the order the budgets were first set: `<category> limit <limit> spent <spent> left <left>`. `<spent>` is the sum of the amounts of the month's entries in the category, negated, so expenses count up and refunds count down; `<left>` is the limit minus spent and may be negative. All three have two decimals. Without budgets it SHALL print `No budgets`. A month that is not `YYYY-MM` SHALL print `ledger: invalid month <text>` to stderr and exit 2.

#### Scenario: Status of a month

- **WHEN** the budget of `food` is `300.00` and the `food` entries are `-12000` on `2026-10-02`, `-3050` on `2026-10-05` and `-9900` on `2026-09-30`
- **THEN** `ledger budget list --month 2026-10` prints `food limit 300.00 spent 150.50 left 149.50`

#### Scenario: Over budget

- **WHEN** the budget of `food` is `300.00` and the October `food` entries sum to `-32000`
- **THEN** `ledger budget list --month 2026-10` prints `food limit 300.00 spent 320.00 left -20.00`

#### Scenario: Refund lowers spent

- **WHEN** the October `food` entries are `-5000` and `1000`, and the budget of `food` is `300.00`
- **THEN** `ledger budget list --month 2026-10` prints `food limit 300.00 spent 40.00 left 260.00`

#### Scenario: Current month by default

- **WHEN** `LEDGER_TODAY` is `2026-10-08` and `ledger budget list` runs
- **THEN** it reports the entries of `2026-10`

#### Scenario: No budgets

- **WHEN** the book holds no budget
- **THEN** `ledger budget list` prints `No budgets`
