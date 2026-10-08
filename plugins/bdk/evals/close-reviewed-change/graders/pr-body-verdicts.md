---
type: regex
target: { source: file, path: .git/bdk-eval/prs/1.json }
pattern: '"body": "(?=(?:[^"\\]|\\.)*\btally\b)(?=(?:[^"\\]|\\.)*Verdict: PASS|(?:[^"\\]|\\.)*\bPASS\b)'
---

The PR body names the capability `tally` and a passing verdict.
