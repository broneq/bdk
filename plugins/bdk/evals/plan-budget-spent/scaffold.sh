#!/usr/bin/env bash
# The shared Change with the planted plan parts of verify-plan-defects, and a budget of one verifier pass.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../fixtures/ledger-change.sh"
mkdir -p openspec/changes/add-csv-export/plan/parts
cp "$here"/../verify-plan-defects/parts/*.md openspec/changes/add-csv-export/plan/parts/
cat >> .bdk/settings.yaml <<'YAML'
policy:
  budgets:
    verifier: 1
YAML
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan add-csv-export"
