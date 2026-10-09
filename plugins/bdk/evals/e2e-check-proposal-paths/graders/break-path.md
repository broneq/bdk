---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/verdict.md }
flags: m
pattern: '^- (pass|fail|blocked): [^\n]*\(break, proposal\.md:\d+\)'
---
