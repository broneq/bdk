## Purpose

Brings the entries of a bank statement saved as CSV into the book, without adding the same entry twice when a statement is imported again.

## ADDED Requirements

### Requirement: Statement import

`ledger import <file> [--account <name>]` SHALL read `<file>` as CSV text and add one entry per data line to the account (`main` when not given), with the category `null`, and print `Imported <n> entries, skipped <m> duplicates`.

- The first line is the header. Fields are separated by commas; a field may be wrapped in double quotes, inside which a comma is text and two double quotes stand for one. Lines end with `\n` or `\r\n`; empty lines are skipped.
- Columns are found by their header name, ignoring case and surrounding spaces: the date in `date`; the description in `description`, or in `payee` when there is no `description`; the amount in `amount`, or, when there is no `amount`, in the two columns `debit` and `credit`, where a value in `debit` is money out (the entry amount is that value negated) and a value in `credit` is money in. When a name occurs twice, the first column counts. A file without any line has no header and so no `date` column.
- A date is `YYYY-MM-DD` or `DD.MM.YYYY` and is stored as `YYYY-MM-DD`. An amount is decimal units with up to two decimals and an optional sign.

Errors, printed as `ledger: <message>` to stderr with exit code 2, after which nothing is imported: a file that cannot be read `cannot read <file>`; a header without one of the three columns `<file> has no <date|description|amount> column`; a line with a bad value `<file> line <n>: not a date: <text>` or `<file> line <n>: not an amount: <text>`, or with both or neither of `debit` and `credit` filled `<file> line <n>: needs one of debit and credit`, where `<n>` counts the lines of the file from 1 for the header; an account the book does not hold `no account <name>`.

#### Scenario: Debit and credit columns

- **WHEN** `statement.csv` holds the lines `Date,Payee,Debit,Credit`, `02.10.2026,Coffee House,4.50,` and `03.10.2026,Salary,,2500.00`, and `ledger import statement.csv` runs on a new book
- **THEN** it prints `Imported 2 entries, skipped 0 duplicates`, and the book holds `2026-10-02` `Coffee House` `-450` and `2026-10-03` `Salary` `250000`, both on `main` with the category `null`

#### Scenario: Quoted fields

- **WHEN** a statement line holds the description `"Smith, J."` or `"Say ""hi"""`
- **THEN** the imported descriptions are `Smith, J.` and `Say "hi"`

#### Scenario: Bad line imports nothing

- **WHEN** line 3 of `statement.csv` holds the date `31.02.2026` and `ledger import statement.csv` runs
- **THEN** it prints `ledger: statement.csv line 3: not a date: 31.02.2026` to stderr, exits 2, and the book is unchanged

#### Scenario: Debit and credit both filled

- **WHEN** line 2 of `statement.csv` (header `Date,Payee,Debit,Credit`) is `02.10.2026,Coffee,4.50,1.00`
- **THEN** `ledger import statement.csv` prints `ledger: statement.csv line 2: needs one of debit and credit` to stderr, exits 2, and the book is unchanged

#### Scenario: Missing column

- **WHEN** the header of `statement.csv` is `When,Payee,Amount`
- **THEN** `ledger import statement.csv` prints `ledger: statement.csv has no date column` to stderr and exits 2

#### Scenario: Import into an account

- **WHEN** the book holds the account `card` and `ledger import statement.csv --account card` runs
- **THEN** every imported entry has the account `card`

### Requirement: Duplicates

A data line SHALL count as a duplicate of an entry of the target account with the same date, description and amount. When a statement holds k equal lines and the account already holds j entries equal to them, `ledger import` SHALL add k - j of them when k > j and none otherwise, and count the others as skipped.

#### Scenario: Same statement twice

- **WHEN** `ledger import statement.csv` runs twice on a statement of two lines
- **THEN** the second run prints `Imported 0 entries, skipped 2 duplicates` and the book holds two entries

#### Scenario: Equal lines in one statement

- **WHEN** a statement holds two equal lines `02.10.2026,Coffee,4.50,` and is imported into a new book, and then a statement with three such lines is imported
- **THEN** the first import adds 2 entries, and the second prints `Imported 1 entries, skipped 2 duplicates`
