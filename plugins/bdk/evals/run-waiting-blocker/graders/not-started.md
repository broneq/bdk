---
type: regex
target: trace
pattern: '"skill"\s*:\s*"(?:[\w-]+:)?propose"|"command"\s*:\s*"[^"]*\b(?:git (?:switch|checkout)\b[^"]*2-count-entries|openspec new change\b)'
match: not_contains
---

The waiting Change gets no branch, no Change directory and no stage.
