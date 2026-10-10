#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report.sh"
# A verify round as pr-review-round leaves it before the judge: the finding of the previous
# review seeded first, then a reviewer's finding of the same, still unfixed, parse bug.
cat > .bdk/runs/monthly-report/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-0a1b2c3d4e5f","source":"previous-review","summary":"Amounts with fewer than two decimals parse to the wrong number of cents","file":"src/parse.js","line":13,"evidence":"`parseEntries('2026-01-05,rent,7')` gives amount 7 and `12.5` gives 125; the scenario \"Amounts with fewer decimals\" needs 700 and 1250."}
{"type":"finding","id":"f-5c2e9d71b4a8","source":"review-group","summary":"parseEntries drops the decimal point instead of scaling to cents","file":"src/parse.js","line":13,"evidence":"`amt.replace('.', '')` turns '7' into 7 and '12.5' into 125 instead of 700 and 1250, so a ledger line with a whole or one-decimal amount is off by a factor of 10 or 100. Spec scenario 'Amounts with fewer decimals' fails, as `parseEntries('2026-01-05,rent,7')` shows; the part's tests use only two-decimal amounts."}
JSONL
