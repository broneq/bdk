#!/usr/bin/env bash
# The tally project whose proposal also promises `tally total --json`. No spec scenario names the
# flag and the product ignores it: only a tester that derives its paths from the proposal meets
# it. The empty-ledger defect of the shared fixture is fixed, so `--json` is the planted defect.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-cli.sh"
cat > openspec/changes/add-total/proposal.md <<'MD'
## Why

Users want to see the sum of what they added to the ledger, and their scripts want to read it.

## What Changes

- New command `tally total`.
- `tally total --json` prints the total as JSON, `{"total": <sum>}`, for scripts.
MD
perl -0pi -e 's/  if \(!existsSync\(FILE\)\) \{\n    console.error\("tally: no ledger here"\);\n    process.exit\(1\);\n  \}\n  const total = load\(\)/  const total = (existsSync(FILE) ? load() : [])/' bin/tally.js
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -am "feat: tally total --json in the proposal"
