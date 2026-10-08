---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/result.md }
pattern: '^Status: (done|blocked)\n[\s\S]*## Deferred[\s\S]*f-8c0aba573c66'
---

The stage result lists the deferred nice-to-have finding for the PR body.
