#!/usr/bin/env bash
# Round 1 of add-total with three test gaps, not yet leveled, none naming its scenario: the
# scenarios Empty ledger and Help, which the delta holds, part 01 lists and the code does, have
# no test; no test covers tally total on negative amounts, which no scenario asks for (#371).
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-total-untested.sh"
ROUND=.bdk/runs/add-total/review/round-1
rm "$ROUND/review.md"
cat > "$ROUND/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-86d92ef246f3","source":"review-group","summary":"No test for tally total without a ledger","file":"test/total.test.js","line":10,"evidence":"tally total in a directory without ledger.json prints 'Total: 0.00' today, but the only test adds amounts first: changing the total branch to print 'Total: none' when ledger.json is missing keeps every test green. Only a test is missing; the behaviour is right."}
{"type":"finding","id":"f-3c51e7a09b42","source":"review-group","summary":"No test for tally total on negative amounts","file":"test/total.test.js","line":10,"evidence":"tally add -5 then tally total prints 'Total: -5.00' today, but no test adds a negative amount: a change that drops the sign in total keeps every test green. Only a test is missing; the behaviour is right."}
{"type":"finding","id":"f-a17d4c90e5b8","source":"review-group","summary":"No test for the usage line","file":"bin/tally.js","line":6,"evidence":"tally --help prints 'usage: tally add <amount> | tally total' today, but no test runs --help: reverting USAGE to 'usage: tally add <amount>' keeps every test green. Cosmetic: only the help text, and only a test is missing."}
JSONL
