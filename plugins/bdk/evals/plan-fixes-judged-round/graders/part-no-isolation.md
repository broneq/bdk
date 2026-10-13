---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/fixes/parts/03.md }
pattern: '^isolation:'
flags: m
match: not_contains
---

The fix part carries no `isolation`: every part runs in the main checkout.
