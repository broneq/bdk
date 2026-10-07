---
type: regex
target: { source: file, path: .git/logs/HEAD }
pattern: '\tcommit: docs(?:\([^)]*\))?!?: '
---

The README typo fix was committed on its own as a `docs` commit.
