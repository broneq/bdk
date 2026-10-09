---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
pattern: '"type":"level","id":"f-0a1b2c3d4e5f","level":"blocker"'
---

The seeded finding of the previous review keeps `blocker`: the parse bug is still there, so the main thread of `/bdk:pr-review --verify` leaves its thread open.
