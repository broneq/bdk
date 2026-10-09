---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?plan"' }
after: { tool: Read, input_match: 'plan/verify-1\.md' }
---
