---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-2/groups.json }
pattern: '"anchor":\{"kind":"round"[^}]*"round":1\}[\s\S]*"tests":\["src/parse\.test\.js"\],"testsOnly":true'
---

Round 2 covers only the fix commit, a test file, and bdk git groups records it as tests only.
