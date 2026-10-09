---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/verdict.md }
flags: m
pattern: '(^- (pass|fail|blocked|not-driven): [^\n]*\n){6}'
match: not_contains
---
