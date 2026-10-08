---
type: regex
target: { source: file, path: .git/bdk-eval/reviews/7-1.json }
pattern: '"comments"\s*:\s*\[[\s\S]*"path"\s*:\s*"(src/report\.js|bin/ledger\.js)"'
---

An inline comment on the report code, which formats the cents of `parseEntries` as dollars.
