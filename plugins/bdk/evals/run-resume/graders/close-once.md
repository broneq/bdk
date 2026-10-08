---
type: regex
target: trace
pattern: '"skill"\s*:\s*"(?:[\w-]+:)?close"'
match: "count:1"
---

Only add-count is closed; add-total is done and is not closed again.
