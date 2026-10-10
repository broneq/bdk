---
type: regex
target: { source: file, path: .git/bdk-eval/prs/1.json }
pattern: '"body": "(?=(?:[^"\\]|\\.)*Verdict: FAIL)(?=(?:[^"\\]|\\.)*empty-ledger)(?=(?:[^"\\]|\\.)*f-4d2e8a1c7b90)'
---

The PR body holds the failing E2E verdict with the cleared path and its finding id.
