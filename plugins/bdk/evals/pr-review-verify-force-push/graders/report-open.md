---
type: regex
target: { source: file, path: .git/bdk-eval/resolved.json }
pattern: 'PRRT_7_1_2'
match: not_contains
---

The thread on `src/report.js`, whose bug is still there, stays open.
