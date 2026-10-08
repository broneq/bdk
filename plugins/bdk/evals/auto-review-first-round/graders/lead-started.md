---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?auto-review"' }
after: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:lead"[\s\S]*review-round|review-round[\s\S]*"subagent_type"\s*:\s*"bdk:lead"' }
---
