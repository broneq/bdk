---
type: regex
target: { source: file, path: .bdk/runs/add-total/execute/part-01.md }
pattern: 'openspec validate add-total --strict: pass'
---

A part that changed a spec delta validates the Change and names the run under `## Checks` (#373).
