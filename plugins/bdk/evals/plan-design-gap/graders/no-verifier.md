---
type: regex
target: trace
pattern: '^(?![\s\S]*"name"\s*:\s*"Agent"\s*,\s*"input"\s*:\s*\{[^{}]*"subagent_type"\s*:\s*"bdk:verifier")'
---

No Agent call starts bdk:verifier: the gap stops the run before verification.
