---
type: regex
target: { source: file, path: openspec/changes/fix-total-crash/specs/tally/spec.md }
pattern: '^(?![\s\S]*#### Scenario:[^\n]*\n(?:(?!#### )[\s\S])*?ledger\.json[^\n]*(?:\[\s*"|"5"|"2\.5"|text|string))'
---

The spec delta holds no scenario for a ledger file already holding text amounts: that related defect is named in the diagnosis, not fixed in this Change (#359).
