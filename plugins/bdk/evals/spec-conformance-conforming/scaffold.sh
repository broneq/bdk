#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-change.sh"
# E2E results of the Change, as e2e-check writes them in review round 1 (ignored by git, like
# every run file).
mkdir -p .bdk/runs/add-total/review/round-1/e2e
cat > ".bdk/runs/add-total/review/round-1/e2e/verdict.md" <<'MD'
Verdict: PASS

## see-the-total
- pass: main (main, proposal.md:7) - see-the-total--main.md
- pass: empty-ledger (variant, proposal.md:7) - see-the-total--empty-ledger.md
- pass: repeated-total (break, proposal.md:7) - see-the-total--repeated-total.md

## read-the-usage
- pass: main (main, proposal.md:8) - read-the-usage--main.md
- pass: unknown-command (break, proposal.md:8) - read-the-usage--unknown-command.md

## Not a user process
- None.
MD
path() {
  cat > ".bdk/runs/add-total/review/round-1/e2e/$1--$2.md" <<MD
Result: pass
Process: $1
Path: $2 ($3)
Proposal: openspec/changes/add-total/proposal.md:$4 - $5
Item: cli (cli)

## Steps
1. $6

## Expected
$7

## Observed
$7
MD
}
total='New command `tally total`.'
usage='The usage line names `tally total`.'
path see-the-total main main 7 "$total" '`tally add 5`, `tally add 2.5`, `tally total` in a fresh directory -> exit 0' '`Total: 7.50`, exit 0'
path see-the-total empty-ledger variant 7 "$total" '`tally total` in a fresh directory -> exit 0' '`Total: 0.00`, exit 0'
path see-the-total repeated-total break 7 "$total" '`tally add 5`, `tally total`, `tally total` in a fresh directory -> exit 0 twice' '`Total: 5.00` both times, exit 0; the ledger still holds one amount'
path read-the-usage main main 8 "$usage" '`tally --help` -> exit 0' '`usage: tally add <amount> | tally total`, exit 0'
path read-the-usage unknown-command break 8 "$usage" '`tally frobnicate` -> exit 2' 'the usage line, exit 2'
