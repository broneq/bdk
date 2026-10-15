---
type: tool_order
before: { tool: Edit, input_match: 'run\.json[\s\S]*needs-user' }
after: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?close"' }
---
