#!/usr/bin/env bash
# tally-queue.sh under policy.questions decide-and-record, where the scope log of add-total (the
# first Change, checked out) holds SL-1: an AC question no one answered, By: needs-user. The run
# must mark add-total needs-user, call no stage for it, and take add-count to its pull request.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-queue.sh"
cat >> .bdk/settings.yaml <<'YAML'
policy:
  questions: decide-and-record
YAML
cat > openspec/changes/add-total/scope-log.md <<'MD'
# Scope log: add-total

Append only. An AC changes only through an entry By: user.

## SL-1
- Stage: design
- Date: 2026-10-15
- AC: AC-2
- Before: AC-2: The total of an empty ledger prints `Total: 0.00`.
- After: AC-2: The total of an empty ledger prints nothing and exits 0.
- Why: `bin/tally.js` prints no line for an empty ledger today; changing that breaks the scripts that parse its output.
- Options: print nothing (default); print `Total: 0.00` as AC-2 says
- By: needs-user
MD
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "docs: an open scope question of add-total"
