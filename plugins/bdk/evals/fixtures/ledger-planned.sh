#!/usr/bin/env bash
# Shared fixture: the Change add-csv-export of ledger-change.sh with its two
# verified plan parts committed, ready to execute, written into the current
# directory. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-change.sh"

parts=openspec/changes/add-csv-export/plan/parts
mkdir -p "$parts"

cat > "$parts/01.md" <<'MD'
---
id: "01"
depends-on: []
isolation: worktree
files:
  - src/csv.js
  - src/csv.test.js
---

# Part 01: CSV text

## Goal

`toCsv(entries)` in the new module `src/csv.js` turns ledger entries into the CSV text of spec `ledger-export`, closing with the total line from `balance`.

## Acceptance scenarios

- `ledger-export` / Requirement: CSV text / Scenario: No entries
- `ledger-export` / Requirement: CSV text / Scenario: Amount in cents
- `ledger-export` / Requirement: CSV text / Scenario: Description with a comma
- `ledger-export` / Requirement: CSV text / Scenario: Total line

## Tasks

1. Add `toCsv` writing the header, one line per entry in input order, quoted descriptions and the total line
   - File: src/csv.js, src/csv.test.js
   - Interface: toCsv(entries: { date: string, description: string, amount: number }[]): string, exported; the total comes from the existing balance(entries) of src/ledger.js
   - Verified by: ledger-export / Requirement: CSV text / Scenario: No entries, Scenario: Description with a comma, Scenario: Total line; src/csv.test.js
2. Format integer cents as decimal units with two decimals, using integer division and remainder, never a float
   - File: src/csv.js, src/csv.test.js
   - Interface: formatCents(cents: number): string, private to src/csv.js
   - Verified by: ledger-export / Requirement: CSV text / Scenario: Amount in cents; src/csv.test.js
MD

cat > "$parts/02.md" <<'MD'
---
id: "02"
depends-on: ["01"]
isolation: worktree
files:
  - bin/ledger.js
  - test/cli.test.js
  - package.json
---

# Part 02: Export command

## Goal

`ledger export <file>` prints the CSV text of a JSON file of entries, using `toCsv` from part 01, and fails with exit code 2 on a file it cannot read.

## Acceptance scenarios

- `ledger-export` / Requirement: Export command / Scenario: Export a file
- `ledger-export` / Requirement: Export command / Scenario: Missing input file

## Tasks

1. Add the executable module `bin/ledger.js` (`#!/usr/bin/env node`) with the subcommand `export <file>`: read the file, parse the JSON array, print `toCsv(entries)` to stdout, exit 0; on a read or parse error, or a value that is not an array, print `ledger: cannot read <file>` to stderr, nothing to stdout, exit 2
   - File: bin/ledger.js, test/cli.test.js
   - Interface: command `ledger export <file>`; imports toCsv from src/csv.js (part 01)
   - Verified by: ledger-export / Requirement: Export command / Scenario: Export a file, Scenario: Missing input file; test/cli.test.js runs `spawnSync(process.execPath, ["bin/ledger.js", "export", <path>])` against files in a temporary directory
2. Register the command
   - File: package.json
   - Interface: package.json `"bin": { "ledger": "bin/ledger.js" }`
   - Verified by: `npm test` passes; `node bin/ledger.js export <file>` as in task 1
MD

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan add-csv-export"
