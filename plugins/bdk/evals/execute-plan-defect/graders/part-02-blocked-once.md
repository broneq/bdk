---
type: regex
target: { source: file, path: .bdk/runs/add-totals/state.json }
pattern: '"02"\s*:\s*\{(?=[^}]*"status"\s*:\s*"blocked")(?=[^}]*"attempts"\s*:\s*1\b)[^}]*\}'
---

Part 02 is blocked after one implementer run: a plan defect is not retried.
