---
type: tool_used
tool: Write
input_match: '^(?=[\s\S]*fixes/parts/\d\d\.md)(?=[\s\S]*f-4b2e91c07a35)(?=[\s\S]*#### Scenario:)(?=[\s\S]*WHEN)(?=[\s\S]*THEN)(?=[\s\S]*not an amount)'
---

The task that adds the error to the delta asks for at least one `#### Scenario:` with its WHEN and THEN: OpenSpec refuses a requirement without one (#373).
