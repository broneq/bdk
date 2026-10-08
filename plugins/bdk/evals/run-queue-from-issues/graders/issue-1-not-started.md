---
type: regex
target: trace
pattern: '--name 1-|"command"\s*:\s*"[^"]*\bgit (?:switch|checkout) -c 1-'
match: not_contains
---
