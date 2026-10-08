---
type: regex
target: { source: file, path: .bdk/runs/add-totals/state.json }
pattern: '"01"\s*:\s*\{[^}]*"status"\s*:\s*"done"[\s\S]*"02"\s*:\s*\{[^}]*"status"\s*:\s*"done"'
---

The lead recorded both parts as done in `state.json`.
