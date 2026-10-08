---
type: regex
target: { source: file, path: openspec/changes/fix-total-crash/specs/tally/spec.md }
pattern: '#### Scenario:[^\n]*\n(?:(?!#### )[\s\S])*?tally add(?:(?!#### )[\s\S])*?Total: \d+\.\d\d'
---

The spec delta holds a scenario that adds an amount and expects the printed total.
