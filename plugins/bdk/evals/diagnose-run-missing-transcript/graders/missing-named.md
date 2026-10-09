---
type: regex
target: { source: file, path: .bdk/runs/fix-total-crash/diagnostics.md }
pattern: '## Agents[\s\S]*?a8825458cd75f6395[^\n]*missing[\s\S]*?## Missing data[\s\S]*?(?:a8825458cd75f6395|bdk:judge)'
---

The judge is listed as missing under Agents and named under Missing data.
