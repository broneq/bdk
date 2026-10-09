---
type: regex
target: { source: file, path: .bdk/runs/fix-total-crash/debug/diagnosis.md }
pattern: '(?:^|\n)Related: [^\n]*(?:ledger|text|string)'
---

The ledgers already written with text amounts are named on a `Related:` line of the diagnosis, so the user can give them their own Change (#359).
