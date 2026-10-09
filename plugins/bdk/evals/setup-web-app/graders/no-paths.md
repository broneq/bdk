---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: '^\s*paths:'
flags: m
match: not_contains
---
