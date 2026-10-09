---
type: regex
target: { source: file, path: openspec/changes/fix-total-crash/plan/parts/01.md }
pattern: '## Acceptance scenarios\n\n- [^\n]+\n\n## Tasks'
---

The part's only acceptance scenario is the reproduction, also when the diagnosis finds a related defect: the ledgers already written with text amounts are named, not fixed (#359).
