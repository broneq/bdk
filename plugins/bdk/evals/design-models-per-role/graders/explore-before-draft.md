---
type: tool_order
before: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:explorer"' }
after: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?design-draft"' }
---
