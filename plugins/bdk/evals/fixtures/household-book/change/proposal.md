# Proposal

## Why

Households use `ledger` for more than one account and want to see where their money goes. Today the book is one flat list with one balance: no accounts, no categories, no way to bring in a bank statement, no budget, no report.

## What Changes

- **BREAKING** The book file becomes a versioned object (`version: 2`) with accounts, categories, rules, budgets, recurring entries and entries; a version 1 file (the array of today) is migrated when it is read. Commands become modules under one dispatcher with `--name value` options, `ledger --help` lists every command, and `LEDGER_TODAY` fixes today's date.
- `ledger add` takes `--date`, `--account` and `--category`; `ledger balance` takes `--account`.
- Accounts and transfers between them: `ledger account add|list`, `ledger transfer`.
- Categories, categorization rules and `ledger categorize`.
- Bank statement import from CSV: `ledger import`, with duplicate detection.
- Monthly budgets per category and recurring entries: `ledger budget set|list`, `ledger recurring add|list|run`.
- Entry filters, `ledger list` and `ledger export` as CSV or JSON.
- Reports: `ledger report monthly|categories|budget`.

## Capabilities

### New Capabilities

- `ledger-accounts`: accounts and transfers.
- `ledger-categories`: categories, rules and categorizing entries.
- `ledger-import`: importing a bank statement in CSV.
- `ledger-budgets`: monthly budgets per category.
- `ledger-recurring`: recurring entries and adding the due ones.
- `ledger-views`: entry filters, the entry list and the export.
- `ledger-reports`: monthly, category and budget reports.

### Modified Capabilities

- `ledger`: the book file version 2 and its migration, the options of `add` and `balance`, the command dispatch and help, today's date.

## Out of scope

- More than one currency; amounts stay integer cents of one implicit currency.
- Statement formats other than CSV with a header line.
- Editing or deleting entries.

## Impact

- `bin/ledger.js` becomes a thin entry point; new modules under `src/`, `src/commands/` and `src/reports/`, tests under `src/` and `test/`.
- The book file format changes; old files keep working through the migration.
- No new dependency: Node 22 standard library and `node:test` only.
