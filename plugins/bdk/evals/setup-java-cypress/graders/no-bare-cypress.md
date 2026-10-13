---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?[^\n]*\bcypress\s+run'
match: not_contains
---
