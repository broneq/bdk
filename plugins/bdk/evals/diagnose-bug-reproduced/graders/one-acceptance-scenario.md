---
type: regex
target: { source: file, path: openspec/changes/fix-total-crash/plan/parts/01.md }
pattern: '## Acceptance scenarios\n\n- [^\n]+\n\n## Tasks'
---

The part's only acceptance scenario is the reproduction: a scenario that already passes cannot be seen red, and its test would block the implementer (#262).
