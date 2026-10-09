---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-2/findings.jsonl }
pattern: '"type":"finding"[^\n]*(fewer than two decimals|fewer decimals|\(.?7.?\) gives|''7'' gives|12\.5[^\n]*125\b)'
flags: i
match: not_contains
---

Round 1 accepted the parse bug of amounts with fewer than two decimals; round 2 does not raise it again.
