---
type: regex
target: trace
pattern: '"command"\s*:\s*"[^"]*\b(?:gh pr create|git push)\b'
match: not_contains
---
