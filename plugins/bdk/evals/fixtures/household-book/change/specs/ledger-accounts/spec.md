## Purpose

Lets a household keep several accounts, such as a current account and savings, in one book, and move money between them.

## ADDED Requirements

### Requirement: Accounts

A book SHALL start with the account `main`. `ledger account add <name>` SHALL add an account and print `Added account <name>`. A name SHALL start with a lowercase letter followed by lowercase letters, digits or `-`; any other name SHALL print `ledger: invalid name <name>` to stderr and exit 2, and a name the book already holds SHALL print `ledger: account <name> exists` and exit 2. `ledger account list` SHALL print one line per account in the order they were added, `<name> <balance>`, the balance being the sum of the account's entries with two decimals. A missing or unknown subcommand SHALL print `ledger: account needs one of add, list` and exit 2.

#### Scenario: Add an account

- **WHEN** `ledger account add savings` runs on a new book
- **THEN** it prints `Added account savings` and `ledger account list` prints `main 0.00` and `savings 0.00`

#### Scenario: Invalid account name

- **WHEN** `ledger account add Savings` runs
- **THEN** it prints `ledger: invalid name Savings` to stderr and exits 2

#### Scenario: Existing account

- **WHEN** `ledger account add main` runs
- **THEN** it prints `ledger: account main exists` to stderr and exits 2

#### Scenario: Balances per account

- **WHEN** the book holds the account `savings`, an entry of `10000` on `main` and one of `2500` on `savings`
- **THEN** `ledger account list` prints `main 100.00`, then `savings 25.00`

#### Scenario: Missing subcommand

- **WHEN** `ledger account` runs
- **THEN** it prints `ledger: account needs one of add, list` to stderr and exits 2

### Requirement: Transfers

`ledger transfer <amount> <from> <to> [--date <date>]` SHALL add two entries dated the given date (today when not given), both with the category `null` and the transfer id `t<N>`, where N is one more than the number of transfers the book holds: on `<from>` the amount negated with the description `Transfer to <to>`, on `<to>` the amount with the description `Transfer from <from>`. It SHALL print `Transferred <amount> from <from> to <to>`. Errors, printed as `ledger: <message>` with exit code 2: an amount that is not above zero `transfer amount must be positive`; the same account twice `transfer needs two different accounts`; an account the book does not hold `no account <name>`.

#### Scenario: Transfer between accounts

- **WHEN** the book holds the account `savings` and an entry of `10000` on `main`, and `ledger transfer 30 main savings` runs
- **THEN** it prints `Transferred 30.00 from main to savings`, `ledger account list` prints `main 70.00` and `savings 30.00`, and `ledger balance` prints `Balance: 100.00`

#### Scenario: Transfer ids

- **WHEN** the book holds one transfer and `ledger transfer 5 main savings` runs
- **THEN** both new entries hold the transfer id `t2`

#### Scenario: Same account

- **WHEN** `ledger transfer 5 main main` runs
- **THEN** it prints `ledger: transfer needs two different accounts` to stderr and exits 2

#### Scenario: Negative transfer

- **WHEN** `ledger transfer -5 main savings` runs
- **THEN** it prints `ledger: transfer amount must be positive` to stderr and exits 2
