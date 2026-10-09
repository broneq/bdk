---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?plan"' }
after: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:planner"' }
---
