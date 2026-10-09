---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
pattern: '"type":"level","id":"f-0a1b2c3d4e5f","level":"not-a-problem"'
match: not_contains
---

The seeded finding is never levelled the repeat of the later one, which would make `/bdk:pr-review --verify` call it fixed and resolve its thread.
