---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/findings.jsonl }
pattern: '"type":"finding"[^\n]*"source":"e2e-check"[^\n]*"file":"openspec/changes/add-total/proposal\.md","line":8\b'
---
