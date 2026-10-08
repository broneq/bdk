---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: '^\s*browser:'
match: not_contains
---
