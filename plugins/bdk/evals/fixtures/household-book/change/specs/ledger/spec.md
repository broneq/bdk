## MODIFIED Requirements

### Requirement: Book file

The book SHALL be the file `ledger.json` in the current directory, a JSON object `{ "version": 2, "accounts": [...], "categories": [...], "rules": [...], "budgets": [...], "recurring": [...], "entries": [...] }`. An entry is `{ "date": "YYYY-MM-DD", "description": <text>, "amount": <integer cents>, "account": <account name>, "category": <category name> | null }`; the two entries of a transfer also hold `"transfer": <transfer id>`, and an entry added from a recurring entry holds `"recurring": <recurring id>`.

- A missing file SHALL read as an empty book whose only account is `main`.
- A JSON array (the version 1 book) SHALL read as a version 2 book with the only account `main`, no categories, rules, budgets or recurring entries, and the array's entries, each with the account `main` and the category `null`.
- A command that changes the book SHALL write it as version 2, as JSON with two-space indentation and a final newline. A command that fails SHALL leave the file unchanged.
- When the file cannot be read, is not JSON, is an object whose `version` is not `2`, or is a version 2 object one of whose six collections is not an array, a command SHALL print `ledger: cannot read ledger.json` to stderr and exit 2.

#### Scenario: No book yet

- **WHEN** `ledger balance` runs in a directory without `ledger.json`
- **THEN** it prints `Balance: 0.00` and exits 0

#### Scenario: Broken book

- **WHEN** `ledger.json` holds `{`
- **THEN** `ledger balance` prints `ledger: cannot read ledger.json` to stderr and exits 2

#### Scenario: Version 1 book migrated

- **WHEN** `ledger.json` holds `[{ "date": "2026-09-30", "description": "Rent", "amount": -90000 }]` and `ledger add 10 Refund --date 2026-10-01` runs
- **THEN** `ledger.json` holds `"version": 2`, the accounts `["main"]`, and two entries: `Rent` with the account `main` and the category `null`, then `Refund` with the amount `1000`

#### Scenario: Unknown version

- **WHEN** `ledger.json` holds `{ "version": 3 }`
- **THEN** `ledger balance` prints `ledger: cannot read ledger.json` to stderr and exits 2

### Requirement: Add an entry

`ledger add <amount> <description...> [--date <date>] [--account <name>] [--category <name>]` SHALL add an entry with the amount in cents, the words of the description joined by single spaces, the date (today when not given), the account (`main` when not given) and the category (`null` when not given), and print `Added <amount> <description>`, the amount with two decimals. An amount is decimal units with up to two decimals and an optional sign; a date is a calendar date written `YYYY-MM-DD`.

Errors, each printed to stderr as `ledger: <message>` with exit code 2: a bad amount `not an amount: <text>`; no description `add needs a description`; a bad date `invalid date <text>`; an account the book does not hold `no account <name>`; a category the book does not hold `no category <name>`.

#### Scenario: Add an expense

- **WHEN** `ledger add -12.50 Coffee beans` runs
- **THEN** it prints `Added -12.50 Coffee beans` and the book holds an entry with the amount `-1250`, the description `Coffee beans`, the account `main` and the category `null`

#### Scenario: Add to an account with a category

- **WHEN** the book holds the account `savings` and the category `gifts`, and `ledger add 50 Birthday --date 2026-10-02 --account savings --category gifts` runs
- **THEN** the book holds an entry dated `2026-10-02` with the amount `5000`, the account `savings` and the category `gifts`

#### Scenario: Bad amount

- **WHEN** `ledger add ten Lunch` runs
- **THEN** it prints `ledger: not an amount: ten` to stderr and exits 2

#### Scenario: Unknown account

- **WHEN** `ledger add 5 Lunch --account cash` runs and the book has no account `cash`
- **THEN** it prints `ledger: no account cash` to stderr, exits 2, and the book is unchanged

#### Scenario: Invalid date

- **WHEN** `ledger add 5 Lunch --date 2026-02-30` runs
- **THEN** it prints `ledger: invalid date 2026-02-30` to stderr and exits 2

### Requirement: Balance

`ledger balance [--account <name>]` SHALL print `Balance: <sum>`, the sum of the amounts of all entries, or of the entries of the named account, as decimal units with two decimals. An account the book does not hold SHALL print `ledger: no account <name>` to stderr and exit 2.

#### Scenario: Balance of two entries

- **WHEN** the book holds the amounts `10000` and `-1250`
- **THEN** `ledger balance` prints `Balance: 87.50`

#### Scenario: Balance of one account

- **WHEN** the book holds an entry of `10000` on `main` and one of `2500` on `savings`
- **THEN** `ledger balance --account savings` prints `Balance: 25.00`

### Requirement: Commands

`ledger <command> [arguments] [options]` SHALL run the command `<command>`. `ledger`, `ledger --help` and `ledger help` SHALL print the line `usage: ledger <command> [arguments] [--option value]`, then the line `commands:`, then one line per command in name order, `  <name>  <summary>`, and exit 0. An unknown command SHALL print `ledger: unknown command <name>` to stderr and exit 2. A command with subcommands SHALL take its subcommand from its first argument, and SHALL print `ledger: <command> needs one of <subcommands>` (the subcommands in name order, joined by `, `) to stderr and exit 2 when its subcommand is missing or unknown.

#### Scenario: Help lists the commands

- **WHEN** `ledger --help` runs
- **THEN** its first two lines are `usage: ledger <command> [arguments] [--option value]` and `commands:`, every further line is `  <name>  <summary>` with the names in name order, the line `  add  Add an entry` comes before the line `  balance  Print the balance`, and it exits 0

#### Scenario: Unknown command

- **WHEN** `ledger remove` runs
- **THEN** it prints `ledger: unknown command remove` to stderr and exits 2

## ADDED Requirements

### Requirement: Options

An argument `--<name>` after the command SHALL take the next argument as its value; every other argument is positional, in order, including a negative amount such as `-12.50`. An option the command does not take SHALL print `ledger: unknown option --<name>` to stderr and exit 2; an option without a value SHALL print `ledger: --<name> needs a value` and exit 2. Every command checks its arguments as `ledger add` does: a bad amount SHALL print `ledger: not an amount: <text>`, a bad date `ledger: invalid date <text>` and a bad month `ledger: invalid month <text>`, each to stderr with exit code 2, whether the value is a positional argument or an option's value. A command called without a positional argument it requires SHALL print one `ledger: <message>` line to stderr and exit 2, without writing the book: either `<command> needs <the missing arguments>`, `<command>` with its subcommand (for example `ledger: import needs a file`), or the error of the first check the command's arguments fail when the missing ones are empty texts (for example `ledger: not an amount: ` for `ledger add` without arguments, `ledger: transfer needs two different accounts` for `ledger transfer 10`).

#### Scenario: Unknown option

- **WHEN** `ledger balance --colour red` runs
- **THEN** it prints `ledger: unknown option --colour` to stderr and exits 2

#### Scenario: Option without a value

- **WHEN** `ledger add 5 Lunch --date` runs
- **THEN** it prints `ledger: --date needs a value` to stderr and exits 2

### Requirement: Today

Today SHALL be the value of the environment variable `LEDGER_TODAY` when it is set, and the local calendar date otherwise. A `LEDGER_TODAY` that is not a date `YYYY-MM-DD` SHALL make every command print `ledger: invalid LEDGER_TODAY <value>` to stderr and exit 2.

#### Scenario: Fixed today

- **WHEN** `LEDGER_TODAY=2026-10-08 ledger add 5 Lunch` runs
- **THEN** the new entry is dated `2026-10-08`

#### Scenario: Invalid today

- **WHEN** `LEDGER_TODAY=tomorrow ledger balance` runs
- **THEN** it prints `ledger: invalid LEDGER_TODAY tomorrow` to stderr and exits 2
