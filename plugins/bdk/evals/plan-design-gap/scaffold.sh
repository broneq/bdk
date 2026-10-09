#!/usr/bin/env bash
# The shared Change plus a spec requirement the design does not settle:
# `--out <path>` with no rule for an existing <path>.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/ledger-change.sh"
cat >> openspec/changes/add-csv-export/specs/ledger-export/spec.md <<'MD'

### Requirement: Export to a file

`ledger export <file> --out <path>` SHALL write the CSV text of `<file>` to `<path>` instead of stdout, print nothing to stdout, and exit 0.

#### Scenario: Export to a new file

- **WHEN** `ledger export entries.json --out entries.csv` runs and `entries.csv` does not exist
- **THEN** `entries.csv` holds the CSV text of `entries.json`, stdout is empty, and the exit code is 0
MD
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: export to a file"
