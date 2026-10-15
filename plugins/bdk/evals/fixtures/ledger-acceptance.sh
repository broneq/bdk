#!/usr/bin/env bash
# Shared fixture: ledger-designed.sh where add-csv-export came from issue 7 through the new propose:
# the source saved word for word, a proposal with Intent and Acceptance (AC-4 asks for a semicolon
# option), an empty scope log, and a design that leaves AC-4 out as "Decided without the user".
# Verifier cases of the acceptance criteria start here.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-designed.sh"

change=openspec/changes/add-csv-export
mkdir -p .bdk/runs/add-csv-export/source
cat > .bdk/runs/add-csv-export/source/issue.md <<'MD'
# Issue #7: Export the ledger as CSV

URL: https://github.com/acme/tiny-ledger/issues/7
State: OPEN
Labels: enhancement

## Body

## Goal
Users do their taxes in a spreadsheet and copy entries by hand today. Let them export the entries of a date range as a CSV file a spreadsheet opens.

## Scope
- One row per entry (date, label, amount) and a header row.
- A label holding a comma is quoted.
- Users in a decimal-comma locale can choose a semicolon as the delimiter.

## Acceptance signal
- The export of October 2026 with one rent entry of -900.00 is a header and the row `2026-10-01,rent,-900.00`.
- An empty range gives the header row only.

## Comments

None.
MD

node -e '
const fs = require("fs"); const f = process.argv[1]; let t = fs.readFileSync(f, "utf8");
t = t.replace("## Why\n\nUsers", "## Why\n\nTracks #7.\n\nUsers");
t = t.replace("## What Changes", `## Intent

> Users do their taxes in a spreadsheet and copy entries by hand today. Let them export the entries of a date range as a CSV file a spreadsheet opens.

## Acceptance

- AC-1: The export of October 2026 with one rent entry of -900.00 is a header and the row \`2026-10-01,rent,-900.00\`.
- AC-2: An empty range gives the header row only.
- AC-3: A label holding a comma is quoted.
- AC-4: Users in a decimal-comma locale can choose a semicolon as the delimiter.

## What Changes`);
fs.writeFileSync(f, t);' "$change/proposal.md"

cat > "$change/scope-log.md" <<'MD'
# Scope log: add-csv-export

Append only. An AC changes only through an entry By: user.
MD

node -e '
const fs = require("fs"); const f = process.argv[1]; let t = fs.readFileSync(f, "utf8");
t = t.replace("lost, no user asked for it and the proposal names a spreadsheet, which reads RFC 4180.",
  "lost, the proposal names a spreadsheet, which reads RFC 4180.\n\nDecided without the user: the semicolon option of AC-4 is left out; a comma is enough for a spreadsheet.");
fs.writeFileSync(f, t);' "$change/design.md"
grep -q "Decided without the user" "$change/design.md"
grep -q "AC-4" "$change/proposal.md"

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: add-csv-export from issue 7 with acceptance criteria"
