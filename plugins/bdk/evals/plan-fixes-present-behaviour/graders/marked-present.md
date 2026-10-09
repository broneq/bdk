---
type: regex
target: { source: file, path: .bdk/runs/add-total/review/round-1/fixes/parts/02.md }
pattern: '## Acceptance scenarios\n(?:\n|- [^\n]*\n)*?- [^\n]*Scenario: Empty ledger \(behaviour present\)\n'
---

The code already prints `Total: 0.00` for an empty ledger, so the scenario is marked: its new test passes at its first run.
