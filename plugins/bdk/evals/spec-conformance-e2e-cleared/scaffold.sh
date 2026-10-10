#!/usr/bin/env bash
# tally-e2e-cleared.sh (or the fixture named by $1) plus a second failed path of round 1 whose observation holds:
# `[true, 5]` prints `Total: 6.00` with exit 0. Its finding is levelled blocker and the user
# deferred it, so close must still refuse it (#391 design D1), next to the cleared one (#396).
set -euo pipefail
bash "$(dirname "$0")/../fixtures/${1:-tally-e2e-cleared.sh}"

round=.bdk/runs/add-total/review/round-1
node -e '
const fs = require("node:fs");
const file = process.argv[1];
const text = fs.readFileSync(file, "utf8");
const after = "- pass: repeated-total (break, proposal.md:7) - see-the-total--repeated-total.md\n";
if (!text.includes(after)) throw new Error("fixture changed: no repeated-total line");
fs.writeFileSync(file, text.replace(after, after + "- fail: boolean-entry (break, proposal.md:7) - see-the-total--boolean-entry.md\n"));
' "$round/e2e/verdict.md"

cat > "$round/e2e/see-the-total--boolean-entry.md" <<'MD'
Result: fail
Process: see-the-total
Path: boolean-entry (break)
Proposal: openspec/changes/add-total/proposal.md:7 - New command `tally total`.
Item: cli (cli)

## Steps
1. write `[true, 5]` to `ledger.json` in a fresh directory
2. `node /work/tally/bin/tally.js total` -> exit 0, stdout `Total: 6.00`

## Expected
a message that names the broken ledger, a non-zero exit
Expected from: baseline

## Observed
exit 0, stdout `Total: 6.00`: `true` is counted as 1
MD

cat >> "$round/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-6a1f3c9e0d57","source":"e2e-check","summary":"see-the-total / boolean-entry: tally total prints Total: 6.00 with exit 0 on a ledger holding [true, 5]","file":"openspec/changes/add-total/proposal.md","line":7,"evidence":".bdk/runs/add-total/review/round-1/e2e/see-the-total--boolean-entry.md: expected a message that names the broken ledger and a non-zero exit (baseline); observed exit 0 and `Total: 6.00`"}
{"type":"level","id":"f-6a1f3c9e0d57","level":"blocker","reason":"The observation holds: the reduce at bin/tally.js:19 adds true as 1 and prints Total: 6.00 with exit 0."}
{"type":"decision","id":"f-6a1f3c9e0d57","decision":"defer","reason":"The user wants the ledger check in a later Change."}
JSONL
