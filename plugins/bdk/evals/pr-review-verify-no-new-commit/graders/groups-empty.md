---
type: regex
target: { source: file, path: .bdk/runs/pr-7/review/round-1/groups.json }
pattern: '"groups"\s*:\s*\[\s*\]'
---

No commit since the previous review: the recorded range is empty and holds no group.
