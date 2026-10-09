---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?plan-fixes"' }
after: { tool: Agent, input_match: '--parts' }
---
