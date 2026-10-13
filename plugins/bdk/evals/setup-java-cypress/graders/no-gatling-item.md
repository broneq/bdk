---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?[^\n]*gatling'
match: not_contains
---
