---
type: regex
target: trace
pattern: '"command"\s*:\s*"[^"]*\bgh pr view\b[^"]*(?:pull/1|\b1\b)[^"]*--json[^"]*\bstate\b'
---

The run asks GitHub whether the blocker's pull request is merged.
