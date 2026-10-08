---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
pattern: '"type":"decision","id":"f-093cc3ee1fa8","decision":"defer","reason":"[^"]*review-rounds'
---

The should-fix finding is deferred in the last round, with a reason naming the round budget.
