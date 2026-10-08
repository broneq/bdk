---
type: regex
target: trace
pattern: '"skill"\s*:\s*"(?:[\w-]+:)?(?:propose|design|plan|execute|auto-review)"'
match: not_contains
---

Both Changes are reviewed; no earlier stage runs again.
