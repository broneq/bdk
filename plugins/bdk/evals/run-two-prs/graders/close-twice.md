---
type: regex
target: trace
pattern: '"skill"\s*:\s*"(?:[\w-]+:)?close"'
match: "count:2"
---

`/bdk:close` runs once per Change, not again for a Change already done.
