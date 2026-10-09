---
type: tool_order
before: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:designer"' }
after: { tool: Agent, input_match: '"subagent_type"\s*:\s*"bdk:verifier"' }
---
