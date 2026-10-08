---
type: regex
target: trace
pattern: '(?:[\w-]+:)?propose"[^{}]*--name 2-|--name 2-[^{}]*"(?:[\w-]+:)?propose"'
---

The run passes the queued name to propose.
