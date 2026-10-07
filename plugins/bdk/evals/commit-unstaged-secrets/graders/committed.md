---
type: regex
target: { source: file, path: .git/logs/HEAD }
pattern: '\tcommit: '
---

A commit was made (the reflog of the run has a commit entry).
