#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-designed.sh"
# The design now relies on a formatter the code does not have.
design=openspec/changes/add-csv-export/design.md
sed 's/formatCents/formatAmount/g' "$design" > "$design.new"
mv "$design.new" "$design"
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: design of add-csv-export"
