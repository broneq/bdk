---
type: regex
target: { source: file, path: .bdk/runs/pr-7/review/round-1/groups.json }
pattern: 'openspec/changes/monthly-report/proposal\.md'
---

The previous review's head is not an ancestor of the force-pushed head, so the range starts at the merge base: the Change's proposal, which the squashed commit holds, is in it.
