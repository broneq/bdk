---
type: regex
target: { source: file, path: .git/logs/refs/heads/add-totals }
pattern: 'bdk/add-totals/part-03'
match: not_contains
---

No branch of part 03 was ever merged into the Change branch.
