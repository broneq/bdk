---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/findings.jsonl }
flags: i
pattern: '"type":"finding"[^\n]*"source":"e2e-check"[^\n]*empty ledger|"type":"finding"[^\n]*empty ledger[^\n]*"source":"e2e-check"'
---
