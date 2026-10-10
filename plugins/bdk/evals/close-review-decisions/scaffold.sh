#!/usr/bin/env bash
# tally-reviewed.sh, plus the review stage's result as /bdk:auto-review writes it under
# policy.questions: decide-and-record: an auto triage line and a product decision of the fix pass.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-reviewed.sh"

cat > .bdk/runs/add-total/review/result.md <<'MD'
Status: done

## Rounds
- 1: 0 findings

## Deferred
- None.

## Blockers
- None.

## Decisions taken without the user
- Round 1: triage by policy.gates.review auto.
- Round 1 fix pass: a ledger line that is not a number is refused with `tally: cannot read ledger` instead of being skipped (policy.questions: decide-and-record).
MD
