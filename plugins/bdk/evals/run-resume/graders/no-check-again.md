---
type: regex
target: trace
pattern: '"subagent_type"\s*:\s*"bdk:verifier"|"command"\s*:\s*"[^"]*\bopenspec archive\b'
match: not_contains
---

add-count passed spec-conformance and is archived: the resumed close starts at the push.
