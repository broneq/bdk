## Purpose

Lets a household look at the entries of a month, an account or a category, and take them out of the book as CSV or JSON.

## ADDED Requirements

### Requirement: Entry filters

`ledger list` and `ledger export` SHALL take the filters `--month <YYYY-MM>`, `--account <name>` and `--category <name>`, and select the entries that match every filter given; `--category none` selects the entries whose category is `null`. A month that is not `YYYY-MM` SHALL print `ledger: invalid month <text>` to stderr and exit 2; an account or a category (other than `none`) the book does not hold SHALL print `ledger: no account <name>` or `ledger: no category <name>` and exit 2.

#### Scenario: Month and account

- **WHEN** the book holds entries on `main` and `savings` in September and October 2026, and `ledger list --month 2026-10 --account savings` runs
- **THEN** it prints only the October entries of `savings`

#### Scenario: Entries without a category

- **WHEN** the book holds entries with and without a category, and `ledger list --category none` runs
- **THEN** it prints only the entries whose category is `null`

#### Scenario: Invalid month

- **WHEN** `ledger list --month 2026-13` runs
- **THEN** it prints `ledger: invalid month 2026-13` to stderr and exits 2

### Requirement: Entry list

`ledger list [filters]` SHALL print the selected entries sorted by date, entries of the same date in book order, one per line: `<date> <amount> <account> <category> <description>`, the amount with two decimals and `-` for a `null` category. When no entry is selected it SHALL print `No entries`.

#### Scenario: List entries

- **WHEN** the book holds, in this order, `2026-10-05` `-1250` `main` `food` `Coffee beans` and `2026-10-01` `250000` `main` `null` `Salary`
- **THEN** `ledger list` prints `2026-10-01 2500.00 main - Salary`, then `2026-10-05 -12.50 main food Coffee beans`

#### Scenario: Nothing selected

- **WHEN** `ledger list --month 2025-01` runs and no entry is dated January 2025
- **THEN** it prints `No entries`

### Requirement: Export

`ledger export [--format csv|json] [filters]` SHALL write the selected entries, in the order of `ledger list`, to stdout; the format is `csv` when not given.

- CSV: the header line `date,description,amount,account,category`, then one line per entry; the amount with two decimals; an empty field for a `null` category; a field holding a comma, a double quote or a line break wrapped in double quotes with each inner double quote doubled; every line ending with `\n`.
- JSON: an array of objects `{ "date", "description", "amount", "account", "category" }` with the amount in integer cents and `null` for no category, written with two-space indentation and a final newline.

Another format SHALL print `ledger: unknown format <text>` to stderr and exit 2.

#### Scenario: CSV export

- **WHEN** the book holds one entry `2026-10-02` `-450` `main` `null` described `Smith, J.` and `ledger export` runs
- **THEN** stdout is `date,description,amount,account,category\n2026-10-02,"Smith, J.",-4.50,main,\n`

#### Scenario: JSON export

- **WHEN** the same book and `ledger export --format json` runs
- **THEN** stdout parses as `[{ "date": "2026-10-02", "description": "Smith, J.", "amount": -450, "account": "main", "category": null }]`

#### Scenario: Unknown format

- **WHEN** `ledger export --format xml` runs
- **THEN** it prints `ledger: unknown format xml` to stderr and exits 2
