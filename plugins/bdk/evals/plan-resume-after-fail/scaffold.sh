#!/usr/bin/env bash
# The shared Change, the planted plan parts and the failed report of plan-draft-fix-after-verify.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
from="$here/../plan-draft-fix-after-verify"
bash "$here/../fixtures/ledger-change.sh"
mkdir -p openspec/changes/add-csv-export/plan/parts .bdk/runs/add-csv-export/plan
cp "$from"/parts/*.md openspec/changes/add-csv-export/plan/parts/
cp "$from/verify-1.md" .bdk/runs/add-csv-export/plan/verify-1.md
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan add-csv-export, first check failed"
