---
type: regex
target: { source: file, path: .bdk/tmp/.gitignore }
pattern: '^\*\s*$'
---

The scratch directory ignores itself and everything in it, so git status stays clean.
