#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report-instructions.sh"
cat > .bdk/runs/monthly-report/review/round-1/findings.jsonl <<'JSONL'
{"type":"finding","id":"f-a77ec7927c47","source":"review-group","summary":"Tests of parseEntries are not grouped in a describe block","file":"src/parse.test.js","line":5,"rule":"CLAUDE.md","evidence":"CLAUDE.md asks to group the tests of each exported function in a describe block named after the function; src/parse.test.js calls test() twice at the top level, with no describe block for parseEntries."}
{"type":"finding","id":"f-055f06364419","source":"review-group","summary":"parseEntries is not async","file":"src/parse.js","line":6,"rule":"CLAUDE.md","evidence":"CLAUDE.md asks that every exported function under src/ be async and return a Promise; parseEntries returns its array synchronously."}
JSONL
