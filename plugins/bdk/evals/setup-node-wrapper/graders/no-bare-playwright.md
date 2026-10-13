---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?[^\n]*\bplaywright\s+test'
match: not_contains
---

No item runs `playwright test` itself: the hook blocks it and the wrapper keeps the budget.
