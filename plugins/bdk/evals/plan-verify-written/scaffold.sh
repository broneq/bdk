#!/usr/bin/env bash
# The shared Change with the sound plan of verify-plan-sound, written by hand and never checked.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../fixtures/ledger-change.sh"
mkdir -p openspec/changes/add-csv-export/plan/parts
cp "$here"/../verify-plan-sound/parts/*.md openspec/changes/add-csv-export/plan/parts/
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan add-csv-export"
