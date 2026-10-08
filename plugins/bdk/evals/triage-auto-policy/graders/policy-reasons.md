---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
pattern: '"type":"decision","id":"f-[0-9a-f]{12}","decision":"[a-z]+","reason":"[^"]*policy\.gates\.review'
match: "count:4"
---
