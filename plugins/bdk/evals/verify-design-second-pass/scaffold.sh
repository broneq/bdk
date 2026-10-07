#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-designed.sh"
cat > .bdk/runs/add-csv-export/design/verify-1.md <<'MD'
Verdict: FAIL

## Must address
- M1 design.md "D1": the export formats amounts with `formatAmount`, which no file defines; the formatter is `formatCents`.
  Evidence: src/format.js:2

## Should consider
- S1 design.md "Risks": no word on a label that holds a line break.

## Checked
- `listEntries` exists with the range the design names (src/store.js:12).
- The spec delta covers the one capability of the proposal.
MD
