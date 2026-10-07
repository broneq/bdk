#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report.sh"
cat > .bdk/runs/monthly-report/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-9ffca2edd413","source":"review-group","summary":"Amounts with fewer than two decimals parse to the wrong number of cents","file":"src/parse.js","line":13,"evidence":"parseEntries('2026-01-01,x,7') gives amount 7, not 700, and '12.5' gives 125, not 1250: the decimal point is dropped instead of scaling by 100. Spec scenario 'Amounts with fewer decimals' fails; the part's tests use only two-decimal amounts."}
JSONL
