#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report.sh"
cat > .bdk/runs/monthly-report/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-9ffca2edd413","source":"review-group","summary":"Amounts with fewer than two decimals parse to the wrong number of cents","file":"src/parse.js","line":13,"evidence":"parseEntries('2026-01-01,x,7') gives amount 7, not 700, and '12.5' gives 125, not 1250: the decimal point is dropped instead of scaling by 100. Spec scenario 'Amounts with fewer decimals' fails; the part's tests use only two-decimal amounts."}
{"type":"finding","id":"f-093cc3ee1fa8","source":"review-group","summary":"Abbreviated identifier amt","file":"src/parse.js","line":12,"rule":"BDK-CQ-1","evidence":"amt abbreviates amount; BDK-CQ-1 asks for descriptive identifiers without abbreviations."}
{"type":"finding","id":"f-7f8d50faa9d4","source":"review-group","summary":"parseEntries crashes on an empty file","file":"src/parse.js","line":6,"evidence":"parseEntries('') splits the empty string into one line and reads amt of undefined, so .replace throws a TypeError."}
{"type":"finding","id":"f-8c0aba573c66","source":"review-integration","summary":"Report could offer a newest-first month order","file":"src/report.js","line":13,"evidence":"Users with long ledgers may want the latest month first; no scenario asks for it, ascending order matches the spec."}
JSONL
