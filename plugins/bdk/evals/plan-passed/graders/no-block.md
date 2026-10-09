---
type: regex
target: trace
pattern: '^(?![\s\S]*(?:"skill"\s*:\s*"(?:[\w-]+:)?plan-draft"|"subagent_type"\s*:\s*"bdk:(?:planner|verifier)"))'
---

The last report passed, so neither plan-draft nor a verifier runs.
