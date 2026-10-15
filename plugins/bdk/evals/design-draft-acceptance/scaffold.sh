#!/usr/bin/env bash
# The explored add-csv-export as the new propose leaves it: issue 7 saved, Intent and AC-1 to AC-4
# in the proposal (AC-4 asks for a semicolon option), an empty scope log.
set -euo pipefail
here="$(dirname "$0")/../fixtures"
bash "$here/ledger-explored.sh"
bash "$here/ledger-acceptance/criteria.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
YAML
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: add-csv-export from issue 7 with acceptance criteria"
