---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: 'scoped:'
match: not_contains
---
