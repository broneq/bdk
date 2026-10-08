---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?run"' }
after: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?propose"' }
---
