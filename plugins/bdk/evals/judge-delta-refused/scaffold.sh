#!/usr/bin/env bash
# Round 1 of add-total with the spec-conformance finding on the refused delta, not yet leveled.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-delta-refused.sh"
cat > .bdk/runs/add-total/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-7c1e5a90b244","source":"spec-conformance","summary":"OpenSpec refuses the delta: requirement Bad amount has no scenario","file":"openspec/changes/add-total/specs/tally/spec.md","line":17,"evidence":"M1 specs/tally/spec.md \"Bad amount\": `openspec validate add-total --strict` exits 1 with `ADDED \"Bad amount\" must include at least one scenario`, so openspec archive cannot merge the delta. The product does what the requirement says (bin/tally.js:18-19 prints `tally: not an amount: abc` and exits 1); the delta needs a scenario under the requirement."}
JSONL
