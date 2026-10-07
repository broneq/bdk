#!/usr/bin/env bash
# The shared Change, the planted plan parts of verify-plan-defects and the failed verifier report on them.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../fixtures/ledger-change.sh"
mkdir -p openspec/changes/add-csv-export/plan/parts .bdk/runs/add-csv-export/plan
cp "$here"/parts/*.md openspec/changes/add-csv-export/plan/parts/
cp "$here/verify-1.md" .bdk/runs/add-csv-export/plan/verify-1.md
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan add-csv-export"
