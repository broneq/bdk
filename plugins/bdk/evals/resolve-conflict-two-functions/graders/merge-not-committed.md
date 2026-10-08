---
type: regex
target: { source: file, path: .git/logs/refs/heads/add-totals }
pattern: 'commit \(merge\)'
match: not_contains
---
