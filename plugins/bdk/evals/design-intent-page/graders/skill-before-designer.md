---
type: tool_order
before: { tool: Skill, input_match: 'design' }
after: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:designer"' }
---

`/bdk:design` starts the designer for the intent page; the main session does not write it itself.
