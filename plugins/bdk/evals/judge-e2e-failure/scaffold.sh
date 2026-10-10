#!/usr/bin/env bash
# Round 1 of add-total with the two e2e-check findings of the round, not yet leveled (#391).
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-broken-ledger.sh"
cat > .bdk/runs/add-total/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-5e0c2b7a91d4","source":"e2e-check","summary":"see-total / text-entry: tally total crashes with a TypeError stack trace on a ledger holding [\"abc\"]","file":"openspec/changes/add-total/proposal.md","line":9,"evidence":".bdk/runs/add-total/review/round-1/e2e/see-total--text-entry.md: expected `tally: cannot read ledger.json` on stderr and exit 2 (proposal.md:9); observed exit 1 with `TypeError: total.toFixed is not a function` and its stack trace"}
{"type":"finding","id":"f-b38f61d0c27e","source":"e2e-check","summary":"see-total / boolean-entry: tally total prints Total: 6.00 with exit 0 on a ledger holding [true, 5]","file":"openspec/changes/add-total/proposal.md","line":9,"evidence":".bdk/runs/add-total/review/round-1/e2e/see-total--boolean-entry.md: expected `tally: cannot read ledger.json` on stderr and exit 2 (proposal.md:9); observed exit 0 and `Total: 6.00`"}
JSONL
