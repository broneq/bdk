---
type: regex
target: trace
pattern: '^(?![\s\S]*"name"\s*:\s*"Agent"\s*,\s*"input"\s*:\s*\{[^{}]*"subagent_type"\s*:\s*"bdk:verifier"[\s\S]*"name"\s*:\s*"Agent"\s*,\s*"input"\s*:\s*\{[^{}]*"subagent_type"\s*:\s*"bdk:verifier")(?![\s\S]*"file_path"\s*:\s*"[^"]*verify-2\.md")'
---

One verifier pass (one Agent call for bdk:verifier; the trace repeats `subagent_type` in the agent's progress events), and no second report.
