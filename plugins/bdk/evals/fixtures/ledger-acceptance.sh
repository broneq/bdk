#!/usr/bin/env bash
# Shared fixture: ledger-designed.sh where add-csv-export came from issue 7 through the new propose:
# the source saved word for word, a proposal with Intent and Acceptance (AC-4 asks for a semicolon
# option), an empty scope log, and a design that leaves AC-4 out as "Decided without the user".
# Verifier cases of the acceptance criteria start here.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-designed.sh"
bash "$here/ledger-acceptance/criteria.sh"

change=openspec/changes/add-csv-export
node -e '
const fs = require("fs"); const f = process.argv[1]; let t = fs.readFileSync(f, "utf8");
t = t.replace("lost, no user asked for it and the proposal names a spreadsheet, which reads RFC 4180.",
  "lost, the proposal names a spreadsheet, which reads RFC 4180.\n\nDecided without the user: the semicolon option of AC-4 is left out; a comma is enough for a spreadsheet.");
fs.writeFileSync(f, t);' "$change/design.md"
grep -q "Decided without the user" "$change/design.md"

git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: add-csv-export from issue 7 with acceptance criteria"
