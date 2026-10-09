---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?debug"' }
after: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?auto-review"' }
---
