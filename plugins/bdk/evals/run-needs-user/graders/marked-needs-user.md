---
type: regex
target: { source: file, path: .bdk/runs/run.json }
pattern: '"change"\s*:\s*"add-total"[^}]*"needs-user"\s*:\s*"SL-1"|"needs-user"\s*:\s*"SL-1"[^}]*"change"\s*:\s*"add-total"'
---
