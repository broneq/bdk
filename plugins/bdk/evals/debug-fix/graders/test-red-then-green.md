---
type: regex
target: { source: file, path: .bdk/runs/fix-total-crash/execute/part-01.md }
pattern: '^Status: done[\s\S]*## Acceptance tests\n[\s\S]*?red seen; green seen'
---

The acceptance signal: the reproduction test was seen red before the fix and green after it.
