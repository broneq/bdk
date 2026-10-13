---
type: regex
target: { source: file, path: .git/logs/refs/heads/dated-entries }
pattern: '^(?:.*\n){4}'
match: not_contains
---

The branch holds only its creation and the two part commits: committing the repair is the lead's job.
