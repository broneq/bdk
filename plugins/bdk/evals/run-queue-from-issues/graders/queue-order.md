---
type: regex
target: { source: file, path: .bdk/runs/run.json }
pattern: '"change"\s*:\s*"2-[a-z0-9-]+"[\s\S]*"change"\s*:\s*"1-[a-z0-9-]+"'
---

Issue 2 is queued before issue 1, which it blocks.
