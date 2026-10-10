---
type: regex
target: { source: file, path: openspec/changes/add-total/specs/tally/spec.md }
pattern: '### Requirement: [^\n]*\n(?:(?!### Requirement:)[\s\S])*?#### Scenario:(?:(?!### Requirement:)[\s\S])*?not an amount: abc'
---

The requirement the task adds carries its scenario, so OpenSpec accepts the delta (#373).
