---
type: regex
target: { source: file, path: .git/logs/refs/heads/main }
pattern: '\n.'
match: not_contains
---

main has only the fixture's commit.
