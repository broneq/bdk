---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/result.md }
pattern: '^Status: done\n[\s\S]*\n- 2: (?![^\n]*\bfix:? f-)[^\n]*\n|^Status: blocked\n[\s\S]*\n- 2: [^\n]*\bfix:? f-'
---

The stage result follows its round lines: done when round 2 left nothing decided fix, blocked when it did (#367).
