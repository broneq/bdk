#!/usr/bin/env bash
# Round 1 of add-total with the two spec-conformance findings of the round, not yet leveled.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-ledger-path.sh"
cat > .bdk/runs/add-total/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-4b2e91c07a35","source":"spec-conformance","summary":"No spec delta lists the error tally add prints for a bad amount","file":"openspec/changes/add-total/specs/tally/spec.md","line":1,"evidence":"tally add abc prints `tally: not an amount: abc` to stderr and exits 1 (bin/tally.js:19-20); no requirement of the delta or of the main spec tally describes it. The proposal asks for this one-line error, so the delta is the side that is missing it."}
{"type":"finding","id":"f-d817a3c5e260","source":"spec-conformance","summary":"An absolute TALLY_LEDGER path is read under the current directory","file":"bin/tally.js","line":6,"evidence":"Requirement Ledger file says TALLY_LEDGER is a path absolute or relative to the current directory. bin/tally.js:6 joins it to process.cwd(), so TALLY_LEDGER=/tmp/ledger.json tally add 5 writes <cwd>/tmp/ledger.json (or fails with ENOENT). The proposal asks for absolute paths, so the code is the side that disagrees."}
JSONL
