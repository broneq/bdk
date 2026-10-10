#!/usr/bin/env bash
# tally-reviewed.sh, plus the review stage's result as /bdk:auto-review writes it after a round
# that deferred two findings: a should-fix with an issue and a nice-to-have without one.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-reviewed.sh"

cat > .bdk/runs/add-total/review/result.md <<'MD'
Status: done

## Rounds
- 1: 2 findings (1 should-fix, 1 nice-to-have)

## Deferred
- f-3b7d1c0e9a42 `bin/tally.js:18` Total of a very long ledger is summed in floating point and can drift in the last cent (should-fix, #12)
- f-8c0aba573c66 `bin/tally.js:6` Usage text could list the commands in alphabetical order (nice-to-have)

## Blockers
- None.

## Decisions taken without the user
- Round 1: triage by policy.gates.review auto.
MD
