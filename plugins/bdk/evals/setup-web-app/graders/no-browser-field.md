---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: 'browser:\s*chrome-devtools'
match: not_contains
---
