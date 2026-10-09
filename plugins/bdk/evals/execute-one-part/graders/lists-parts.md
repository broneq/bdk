---
type: tool_order
before: { tool: Skill, input_match: '"skill"\s*:\s*"(?:[\w-]+:)?execute"' }
after: { tool: Glob, input_match: 'plan/parts' }
---

The stage lists the plan parts to confirm part 01 exists before it names implement-part.
