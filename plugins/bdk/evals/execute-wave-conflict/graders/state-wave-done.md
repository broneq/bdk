---
type: regex
target: { source: file, path: .bdk/runs/add-totals/state.json }
pattern: '"waves"\s*:\s*\{\s*"1"\s*:\s*\{[^}]*"status"\s*:\s*"done"'
---

After both merges the wave check passed and the lead marked wave 1 done.
