---
type: regex
target: { source: file, path: .git/logs/HEAD }
pattern: '\tcommit: fix(?:\([^)]*\))?!?: '
---

The due-date bug fix was committed on its own as a `fix` commit.
