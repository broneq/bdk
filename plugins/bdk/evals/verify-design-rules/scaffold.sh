#!/usr/bin/env bash
# The designed Change, whose design puts the CSV writer into src/export.js, plus a project rule
# of stage design that wants it in src/io/csv.js; committed.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-designed.sh"
cat >> .bdk/settings.yaml <<'YAML'
rules:
  IO-1:
    stages: [design]
    text: >-
      Every module that reads or writes a file format (CSV, JSON, ...) lives in `src/io/`,
      one module per format named after it (`src/io/csv.js`). Code outside `src/io/` builds
      no format text; it calls these modules.
YAML
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: design of add-csv-export"
