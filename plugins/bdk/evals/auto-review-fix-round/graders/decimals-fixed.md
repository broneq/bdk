---
type: regex
target: { source: file, path: src/parse.js }
pattern: 'replace\(\s*"\."\s*,\s*""\s*\)'
match: not_contains
---

The blocker is fixed: the decimal point is no longer dropped.
