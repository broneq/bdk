#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-reviewed.sh"
# A late commit breaks the "Empty ledger" scenario: without a ledger file, `tally total` exits 1.
# The E2E results predate it and are gone, as after a rerun that did not happen.
node -e '
const fs = require("node:fs");
const file = "bin/tally.js";
const before = "} else if (command === \"total\") {\n";
const after = before + "  if (!existsSync(FILE)) {\n    console.error(\"tally: no ledger here\");\n    process.exit(1);\n  }\n";
const text = fs.readFileSync(file, "utf8");
if (!text.includes(before)) throw new Error("fixture changed: no total branch");
fs.writeFileSync(file, text.replace(before, after));
'
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "fix: refuse a total without a ledger"
rm -r .bdk/runs/add-total/review/round-1/e2e
