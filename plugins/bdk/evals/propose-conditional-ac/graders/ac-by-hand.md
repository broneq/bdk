---
type: regex
target: { source: file, path: openspec/changes/42-void-entries/proposal.md }
pattern: '## Acceptance(?:(?!\n## )[\s\S])*?AC-\d+[^\n]*\b(?:by hand|REPL)'
---
