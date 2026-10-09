---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: '^(?![\s\S]*ready:[^\n]*greet[^\n]*--help)'
---
