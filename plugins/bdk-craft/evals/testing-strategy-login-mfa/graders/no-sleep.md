---
type: regex
pattern: '(setTimeout|sleep|waitForTimeout)\(\s*\d{3,}'
match: not_contains
---

No test waits a fixed time.
