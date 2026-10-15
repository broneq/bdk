#!/usr/bin/env bash
# The same design, but the user dropped AC-4 at propose: a scope-log entry By: user, AC-4 struck
# in the proposal and named under Out of scope, the design's line saying so.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-acceptance.sh"
change=openspec/changes/add-csv-export
cat >> "$change/scope-log.md" <<'MD'

## SL-1
- Stage: propose
- Date: 2026-10-14
- AC: AC-4
- Before: AC-4: Users in a decimal-comma locale can choose a semicolon as the delimiter.
- After: dropped
- Why: no user of tiny-ledger works in a decimal-comma locale today; the option can come with a settings file.
- Options: drop AC-4 (default); keep AC-4 with a `delimiter` option of the export
- By: user
MD
node -e '
const fs = require("fs");
const p = process.argv[1], d = process.argv[2];
let t = fs.readFileSync(p, "utf8");
t = t.replace("- AC-4: Users in a decimal-comma locale can choose a semicolon as the delimiter.",
  "- ~~AC-4: Users in a decimal-comma locale can choose a semicolon as the delimiter.~~ Dropped by the user (SL-1).");
t = t.replace("- Importing CSV.", "- Importing CSV.\n- A semicolon delimiter (AC-4): dropped by the user, SL-1.");
fs.writeFileSync(p, t);
let s = fs.readFileSync(d, "utf8");
s = s.replace("Decided without the user: the semicolon option of AC-4 is left out; a comma is enough for a spreadsheet.",
  "Scope changed by the user: AC-4 (the semicolon option) dropped at propose, SL-1.");
fs.writeFileSync(d, s);' "$change/proposal.md" "$change/design.md"
grep -q "SL-1" "$change/design.md"
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: AC-4 dropped by the user"
