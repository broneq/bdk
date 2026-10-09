---
type: llm
focus: { source: file, path: .bdk/runs/monthly-report/review/round-2/findings.jsonl }
---

PASS if a finding whose source is `review-integration` says that the report treats the amounts as currency units (dollars) although parsing returns integer cents, so totals print 100 times too large, naming `src/report.js` or `src/parse.js`, and its evidence says the problem lies outside the scope of this fix round (outside the files or the fix of round 1).
FAIL if no `review-integration` finding names this cents and dollars mismatch, or if the finding does not say it lies outside the fix scope.
