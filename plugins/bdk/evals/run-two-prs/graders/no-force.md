---
type: regex
target: trace
pattern: '"command"\s*:\s*"[^"]*\bgit (?:push\b[^"]*--force|rebase\b|merge\b)'
match: not_contains
---
