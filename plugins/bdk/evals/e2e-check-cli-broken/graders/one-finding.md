---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/findings.jsonl }
pattern: '"type":"finding"'
match: "count:1"
---
