---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-2/groups.json }
pattern: '^\{"base":"[^"]+","anchor":\{[^}]*\},"head":"[0-9a-f]+","range":"[^"]+","files":\[(?![^\]]*(?:src/report\.js|bin/ledger\.js|openspec/|\.bdk/))[^\]]*src/parse\.js[^\]]*\]'
---

Round 2 covers only the files of the fix commits: src/parse.js (and its test), nothing the fixes did not change.
