---
type: regex
target: trace
pattern: '^(?![\s\S]*(?:"skill"\s*:\s*"(?:[\w-]+:)?plan-draft"|"subagent_type"\s*:\s*"bdk:planner"))'
---

Parts exist and pass, so plan-draft never runs.
