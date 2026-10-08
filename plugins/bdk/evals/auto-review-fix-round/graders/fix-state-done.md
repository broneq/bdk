---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/fixes/state.json }
pattern: '"03"\s*:\s*\{[^}]*"status"\s*:\s*"done"'
---

The execute lead kept the fix pass state in the fixes directory.
