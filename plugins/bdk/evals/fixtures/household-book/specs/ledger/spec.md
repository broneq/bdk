# ledger Specification

## Purpose

`ledger` is a command-line tool that keeps a ledger of income and expenses in the file `ledger.json` of the current directory.

## Requirements

### Requirement: Book file

The book SHALL be the file `ledger.json` in the current directory, a JSON array of entries `{ "date": "YYYY-MM-DD", "description": <text>, "amount": <integer cents> }`. A missing file SHALL read as an empty book. When the file cannot be read or is not a JSON array, a command SHALL print `ledger: cannot read ledger.json` to stderr and exit 2.

#### Scenario: No book yet

- **WHEN** `ledger balance` runs in a directory without `ledger.json`
- **THEN** it prints `Balance: 0.00` and exits 0

#### Scenario: Broken book

- **WHEN** `ledger.json` holds `{`
- **THEN** `ledger balance` prints `ledger: cannot read ledger.json` to stderr and exits 2

### Requirement: Add an entry

`ledger add <amount> <description...>` SHALL add an entry dated today with the amount in cents and the words of the description joined by single spaces, and print `Added <amount> <description>`. An amount is decimal units with up to two decimals and an optional sign. A bad amount SHALL print `ledger: not an amount: <text>` to stderr and exit 2; a missing description SHALL print `ledger: add needs a description` and exit 2.

#### Scenario: Add an expense

- **WHEN** `ledger add -12.50 Coffee beans` runs
- **THEN** it prints `Added -12.50 Coffee beans` and the book holds an entry with the amount `-1250` and the description `Coffee beans`

#### Scenario: Bad amount

- **WHEN** `ledger add ten Lunch` runs
- **THEN** it prints `ledger: not an amount: ten` to stderr and exits 2

### Requirement: Balance

`ledger balance` SHALL print `Balance: <sum>`, the sum of all amounts as decimal units with two decimals.

#### Scenario: Balance of two entries

- **WHEN** the book holds the amounts `10000` and `-1250`
- **THEN** `ledger balance` prints `Balance: 87.50`

### Requirement: Commands

`ledger` and `ledger --help` SHALL print the usage and exit 0. Any other unknown command SHALL print `ledger: unknown command <name>` to stderr and exit 2.

#### Scenario: Unknown command

- **WHEN** `ledger remove` runs
- **THEN** it prints `ledger: unknown command remove` to stderr and exits 2
