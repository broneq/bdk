---
type: regex
target: { source: file, path: .git/logs/refs/heads/add-totals }
pattern: '\tmerge '
match: not_contains
---
