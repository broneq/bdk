---
type: regex
target: trace
pattern: '"subagent_type"\s*:\s*"bdk:verifier"[\s\S]*?"command"\s*:\s*"[^"]*\bopenspec archive\b[\s\S]*?"command"\s*:\s*"[^"]*\bgh pr create\b'
---

The verifier runs before `openspec archive`, and the archive before `gh pr create` (a `tool_order` grader on Bash cannot load under the free check's grants).
