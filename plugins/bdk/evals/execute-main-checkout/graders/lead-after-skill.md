---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?execute"' }
after: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:lead"' }
---
