---
type: regex
target: { source: file, path: .git/bdk-eval/reviews/7-2.json }
pattern: 'checked only against'
match: not_contains
---

The verify review read the new commits, so it no longer says they were checked only against the previous findings.
