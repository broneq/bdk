#!/usr/bin/env bash
# Round 1 of monthly-report judged and triaged: the parse blocker and the `amt` rename to fix,
# both in src/parse.js; the nice-to-have deferred; the false positive accepted.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report-judged.sh"
ROUND=.bdk/runs/monthly-report/review/round-1
cat >> "$ROUND/findings.jsonl" <<'JSONL'
{"type":"decision","id":"f-9ffca2edd413","decision":"fix","reason":"policy.gates.review auto: blocker"}
{"type":"decision","id":"f-093cc3ee1fa8","decision":"fix","reason":"policy.gates.review auto: should-fix"}
{"type":"decision","id":"f-8c0aba573c66","decision":"defer","reason":"policy.gates.review auto: nice-to-have"}
{"type":"decision","id":"f-7f8d50faa9d4","decision":"accept","reason":"policy.gates.review auto: not-a-problem"}
JSONL
