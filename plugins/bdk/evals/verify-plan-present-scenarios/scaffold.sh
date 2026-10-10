#!/usr/bin/env bash
# The Change count-entries plus this case's plan part from parts/, committed.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../fixtures/tally-modified.sh"
mkdir -p openspec/changes/count-entries/plan/parts
cp "$here"/parts/*.md openspec/changes/count-entries/plan/parts/
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: plan count-entries"
