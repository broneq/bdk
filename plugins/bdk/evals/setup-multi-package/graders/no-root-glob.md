---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: 'paths:\s*(\[\s*|\n\s*-\s*)["'']?\*\*'
match: not_contains
---
