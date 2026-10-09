---
type: regex
target: { source: file, path: .bdk/runs/pr-7/previous.json }
pattern: 'src/parse\.js'
match: not_contains
---

The parse thread is resolved and the previous verify review left only the report finding, so only it is re-checked.
