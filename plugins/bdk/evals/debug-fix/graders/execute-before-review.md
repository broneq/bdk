---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?execute"' }
after: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?auto-review"' }
---
