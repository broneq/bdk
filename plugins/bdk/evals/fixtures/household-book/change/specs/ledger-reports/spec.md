## Purpose

Gives a household tables of where its money went: income and expenses per month, spending per category, and each budget against its limit.

## ADDED Requirements

### Requirement: Report tables

`ledger report <monthly|categories|budget>` SHALL print a table: a header line, then one line per row. Columns are separated by two spaces and padded to their widest cell; text columns are aligned left and amount columns right; trailing spaces are removed. Amounts have two decimals. Transfer entries SHALL count in no report. A missing or unknown report name SHALL print `ledger: report needs one of budget, categories, monthly` to stderr and exit 2.

#### Scenario: Unknown report

- **WHEN** `ledger report yearly` runs
- **THEN** it prints `ledger: report needs one of budget, categories, monthly` to stderr and exits 2

### Requirement: Monthly report

`ledger report monthly [--year <YYYY>]` SHALL report the year (the year of today when not given) with the columns `month` (text), `income`, `expenses` and `net` (amounts): one row per month of the year with at least one entry, in month order. Income is the sum of the month's positive amounts, expenses the sum of its negative amounts negated, net the income minus the expenses. Without a row it SHALL print `No entries`. A year that is not four digits SHALL print `ledger: invalid year <text>` to stderr and exit 2.

#### Scenario: Two months

- **WHEN** the book holds `2026-09-01` `250000`, `2026-09-03` `-12000`, `2026-10-01` `250000`, `2026-10-02` `-120050`, and a transfer of `30000` on `2026-10-04`, and `ledger report monthly --year 2026` runs
- **THEN** it prints exactly these three lines:

  ```text
  month     income  expenses      net
  2026-09  2500.00    120.00  2380.00
  2026-10  2500.00   1200.50  1299.50
  ```

#### Scenario: Year without entries

- **WHEN** `ledger report monthly --year 2020` runs and no entry is dated 2020
- **THEN** it prints `No entries`

### Requirement: Category report

`ledger report categories [--month <YYYY-MM>]` SHALL report the month (the month of today when not given) with the columns `category` (text) and `spent` (amount): one row per category with at least one negative amount in the month, spent being the sum of those negative amounts negated, and the row `(none)` for negative amounts without a category; rows sorted by spent, largest first, then by name; then a last row `total` with the sum of the rows. Without a row it SHALL print `No entries`.

#### Scenario: Spending per category

- **WHEN** the October 2026 entries are `bills` `-120050`, `food` `-4000`, `food` `-2425`, a `-1200` without a category and a `250000` without a category, and `ledger report categories --month 2026-10` runs
- **THEN** it prints exactly these five lines:

  ```text
  category    spent
  bills     1200.50
  food        64.25
  (none)      12.00
  total     1276.75
  ```

### Requirement: Budget report

`ledger report budget [--month <YYYY-MM>]` SHALL report the month (the month of today when not given) with the columns `category` (text), `limit`, `spent`, `left` (amounts) and `status` (text): one row per budget in the order of `ledger budget list`, with the same limit, spent and left, and the status `ok` when left is zero or more and `over` otherwise; then a row `total` with the sums of limit, spent and left and the status of its own left. Without budgets it SHALL print `No budgets`.

#### Scenario: Budget against spending

- **WHEN** the budgets are `food` `300.00`, then `bills` `1500.00`, and the October 2026 entries are `food` `-32000` and `bills` `-120050`, and `ledger report budget --month 2026-10` runs
- **THEN** it prints exactly these four lines:

  ```text
  category    limit    spent    left  status
  food       300.00   320.00  -20.00  over
  bills     1500.00  1200.50  299.50  ok
  total     1800.00  1520.50  279.50  ok
  ```

#### Scenario: Report without budgets

- **WHEN** the book holds no budget and `ledger report budget` runs
- **THEN** it prints `No budgets`
