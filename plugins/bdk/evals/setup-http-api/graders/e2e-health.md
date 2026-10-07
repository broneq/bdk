---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: 'ready:\s*["'']?http://(localhost|127\.0\.0\.1):4000/health'
---
