---
type: llm
focus: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
---

PASS if a finding whose source is `review-integration` says that the report treats the amounts as currency units (dollars) although parsing returns integer cents, so totals print 100 times too large (for example `1475.00` instead of `14.75`), naming `src/report.js` or `src/parse.js`.
FAIL if no `review-integration` finding names this cents and dollars mismatch.
