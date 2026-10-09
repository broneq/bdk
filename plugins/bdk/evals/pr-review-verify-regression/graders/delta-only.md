---
type: regex
target: { source: file, path: .bdk/runs/pr-7/review/round-1/groups.json }
pattern: 'openspec/changes/monthly-report/proposal\.md'
match: not_contains
---

The range starts at the previous review's head: the Change's proposal, added before that head, is not in it.
