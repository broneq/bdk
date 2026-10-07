---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: '^(?![\s\S]*driver:)[\s\S]*command:\s*["'']?npm test'
---
