---
type: regex
target: { source: file, path: .git/bdk-eval/resolved.json }
pattern: '"PRRT_7_1_1"[\s\S]*"PRRT_7_1_2"|"PRRT_7_1_2"[\s\S]*"PRRT_7_1_1"'
---

Both threads of the previous review are resolved: the new commits fix the parse bug and the cents/dollars seam.
