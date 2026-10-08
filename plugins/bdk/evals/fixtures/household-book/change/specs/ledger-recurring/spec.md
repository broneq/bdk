## Purpose

Lets a household record entries that repeat every month, such as rent, once, and add each month's entry when it falls due.

## ADDED Requirements

### Requirement: Recurring entries

`ledger recurring add <amount> <description...> --day <day> [--account <name>] [--category <name>] [--from <date>]` SHALL add a recurring entry with the id `r<N>`, N one more than the number of recurring entries the book holds, due on day `<day>` of every month from the date `--from` (today when not given), and print `Added recurring <id>: <amount> <description> on day <day>`. `<day>` SHALL be a whole number from 1 to 28, otherwise it SHALL print `ledger: day must be 1 to 28` to stderr and exit 2; `--day` is required, and without it the command SHALL print `ledger: recurring add needs --day` and exit 2. The account and the category are checked as for `ledger add`. `ledger recurring list` SHALL print one line per recurring entry, `<id> day <day> <amount> <account> <description>`. A missing or unknown subcommand SHALL print `ledger: recurring needs one of add, list, run` and exit 2.

#### Scenario: Add a recurring entry

- **WHEN** `LEDGER_TODAY=2026-10-08 ledger recurring add -900 Rent --day 1` runs on a new book
- **THEN** it prints `Added recurring r1: -900.00 Rent on day 1` and `ledger recurring list` prints `r1 day 1 -900.00 main Rent`

#### Scenario: Day out of range

- **WHEN** `ledger recurring add -900 Rent --day 31` runs
- **THEN** it prints `ledger: day must be 1 to 28` to stderr and exits 2

### Requirement: Due entries

`ledger recurring run` SHALL, for every recurring entry and every month from the month of its start date to the month of today, take the date of its day in that month; when that date is not before the start date, not after today, and the book holds no entry with this recurring id and this date, it SHALL add an entry with that date and the recurring entry's description, amount, account and category, holding the recurring id. New entries are added in date order, and for one date in the order the recurring entries were added. It SHALL print `Added <n> recurring entries`.

#### Scenario: Due months

- **WHEN** the recurring entry `r1` starts on `2026-08-01` with the day 5 and `LEDGER_TODAY=2026-10-08 ledger recurring run` runs
- **THEN** it prints `Added 3 recurring entries` and the book holds entries of `r1` dated `2026-08-05`, `2026-09-05` and `2026-10-05`

#### Scenario: Not due yet

- **WHEN** the recurring entry `r1` starts on `2026-10-01` with the day 20 and `LEDGER_TODAY=2026-10-08 ledger recurring run` runs
- **THEN** it prints `Added 0 recurring entries`

#### Scenario: Start date respected

- **WHEN** the recurring entry `r1` starts on `2026-08-10` with the day 5 and `LEDGER_TODAY=2026-10-08 ledger recurring run` runs
- **THEN** the first entry of `r1` is dated `2026-09-05`

#### Scenario: Run twice

- **WHEN** `ledger recurring run` runs twice on the same day
- **THEN** the second run prints `Added 0 recurring entries`
