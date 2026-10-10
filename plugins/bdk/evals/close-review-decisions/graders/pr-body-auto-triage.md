---
type: regex
target: { source: file, path: .git/bdk-eval/prs/1.json }
pattern: '"body": "(?:[^"\\]|\\.)*policy\.gates\.review auto'
---

The PR body names the auto triage of round 1.
