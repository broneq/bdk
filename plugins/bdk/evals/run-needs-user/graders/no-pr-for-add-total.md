---
type: regex
target: trace
pattern: '"command"\s*:\s*"[^"]*\bgh pr create\b[^"]*--head[ =]add-total\b'
match: not_contains
---

No stage runs for the Change that needs the user, so no pull request is opened for it.
