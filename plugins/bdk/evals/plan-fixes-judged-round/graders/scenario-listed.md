---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/fixes/parts/03.md }
pattern: '## Acceptance scenarios[\s\S]*Amounts with fewer decimals[\s\S]*## Tasks'
---

The blocker breaks a spec scenario, so the part lists it as an acceptance scenario.
