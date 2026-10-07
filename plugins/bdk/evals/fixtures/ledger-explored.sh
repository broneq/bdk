#!/usr/bin/env bash
# Shared fixture: ledger-proposal.sh plus the code map the explore block writes
# for add-csv-export, so a design-draft case starts where explore ends.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-proposal.sh"

mkdir -p .bdk/runs/add-csv-export/design
cat > .bdk/runs/add-csv-export/design/explore.md <<'MD'
# Explore: add-csv-export

## Touches

- `src/store.js:12` `listEntries({ from, to })` returns the entries of a date range; the export reads from it.
- `src/store.js:5` `addEntry(entry)` keeps `{ date, label, amount }`, amount in integer cents (`src/store.js:6`).
- `src/format.js:2` `formatCents(cents)` renders cents as `-900.00`; the only amount formatter.
- No entry point exports anything yet; the package has no `bin` and no server (`package.json`).

## Patterns

- ES modules with named exports, one concern per file under `src/` (`src/store.js`, `src/format.js`, `src/ledger.js`).
- Amounts stay integer cents inside the code; formatting happens at the edge (`src/format.js:1`).

## Tests

- `node --test` through `npm test` (`package.json`); tests sit next to the code as `*.test.js` (`src/store.test.js:1`, `src/ledger.test.js:1`).

## Gaps

- No CSV writer and no quoting of labels that hold a comma, a quote or a line break.
- No export entry point (function or command).

## Unsure

- The delimiter and the amount format a spreadsheet of the users expects (comma or semicolon; `-900.00` or `-90000`): the proposal does not say.
MD
