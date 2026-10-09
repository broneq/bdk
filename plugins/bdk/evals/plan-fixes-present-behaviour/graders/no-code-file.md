---
type: regex
target: { source: file, path: .bdk/runs/add-total/review/round-1/fixes/parts/02.md }
pattern: '^\s+- bin/tally\.js$'
flags: m
match: not_contains
---

The fix adds a test only; no task changes the command.
