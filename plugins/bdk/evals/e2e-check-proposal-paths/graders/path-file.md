---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/verdict.md }
flags: m
pattern: '^- (pass|fail): [^\n]* - [a-z0-9-]+--[a-z0-9-]+\.md$'
---
