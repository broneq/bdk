#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-change.sh"
# E2E results of the Change, as e2e-check writes them in review round 1 (ignored by git, like
# every run file).
mkdir -p .bdk/runs/add-total/review/round-1/e2e
cat > .bdk/runs/add-total/review/round-1/e2e/verdict.md <<'MD'
Verdict: PASS

- pass: Total of added amounts - total-of-added-amounts.md
- pass: Empty ledger - empty-ledger.md
- pass: Help - help.md
- pass: Unknown command - unknown-command.md
MD
scenario() {
  cat > ".bdk/runs/add-total/review/round-1/e2e/$1.md" <<MD
Result: pass
Requirement: $2
Scenario: $3
Spec: openspec/changes/add-total/specs/tally/spec.md:$4
Item: cli (cli)

## Steps
1. $5

## Expected
$6

## Observed
$6
MD
}
scenario total-of-added-amounts Total "Total of added amounts" 7 '`tally add 5`, `tally add 2.5`, `tally total` in a fresh directory -> exit 0' '`Total: 7.50`, exit 0'
scenario empty-ledger Total "Empty ledger" 12 '`tally total` in a fresh directory -> exit 0' '`Total: 0.00`, exit 0'
scenario help Usage "Help" 23 '`tally --help` -> exit 0' '`usage: tally add <amount> | tally total`, exit 0'
scenario unknown-command Usage "Unknown command" 28 '`tally frobnicate` -> exit 2' 'the usage line, exit 2'
