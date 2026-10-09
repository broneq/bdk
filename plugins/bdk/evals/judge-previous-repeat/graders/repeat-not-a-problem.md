---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
pattern: '"type":"level","id":"f-5c2e9d71b4a8","level":"not-a-problem","reason":"[^"\n]*f-0a1b2c3d4e5f'
---

The reviewer's later finding of the same bug is the repeat: `not-a-problem` with a reason naming the seeded id.
