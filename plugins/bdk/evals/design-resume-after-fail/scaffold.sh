#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-designed.sh"
# The design relies on a formatter the code does not have, and the last check said so.
design=openspec/changes/add-csv-export/design.md
sed 's/formatCents/formatAmount/g' "$design" > "$design.new"
mv "$design.new" "$design"
cat > .bdk/runs/add-csv-export/design/verify-1.md <<'MD'
Verdict: FAIL

## Must address
- M1 design.md "D1": the export formats amounts with `formatAmount`, which no file defines; the formatter is `formatCents`.
  Evidence: src/format.js:2 defines `formatCents`; grep finds no `formatAmount`

## Should consider
- None.

## Checked
- `listEntries` exists with the range the design names (src/store.js:12).
- The spec delta covers the one capability of the proposal.
MD
cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
  gates:
    design: auto
YAML
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: design of add-csv-export, first check failed"
