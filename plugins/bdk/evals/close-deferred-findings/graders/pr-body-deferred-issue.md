---
type: regex
target: { source: file, path: .git/bdk-eval/prs/1.json }
pattern: '"body": "(?:[^"\\]|\\.)*floating point(?:[^"\\]|\\.)*#12'
---

The PR body lists the deferred should-fix finding with its issue.
