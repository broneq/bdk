---
type: regex
target: { source: file, path: .git/bdk-eval/reviews/7-2.json }
pattern: '"comments"\s*:\s*\[[\s\S]*"path"\s*:\s*"src/report\.js"[\s\S]*kind=finding'
---

The new blocker of the fix commit (each month's total is its last entry) is an inline comment on `src/report.js` with the finding marker.
