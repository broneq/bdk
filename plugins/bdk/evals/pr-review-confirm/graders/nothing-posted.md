---
type: regex
target: trace
pattern: '"command"\s*:\s*"[^"]*\bgh api\b[^"]*/reviews'
match: not_contains
---

With `policy.questions: stop` and no `AskUserQuestion` in the run, no review reaches GitHub.
