---
type: regex
target: { source: file, path: .git/bdk-eval/reviews/7-1.json }
pattern: '"comments"\s*:\s*\[[\s\S]*"path"\s*:\s*"src/parse\.js"'
---

An inline comment on `src/parse.js`, where amounts with fewer than two decimals parse to the wrong number of cents.
