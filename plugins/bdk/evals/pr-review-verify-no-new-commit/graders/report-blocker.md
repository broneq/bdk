---
type: regex
target: { source: file, path: .bdk/runs/pr-7/review/round-1/findings.jsonl }
pattern: '"type":"level","id":"f-[0-9a-f]+","level":"blocker"'
---

The report still formats cents as currency units, so the judge keeps the left finding `blocker`.
