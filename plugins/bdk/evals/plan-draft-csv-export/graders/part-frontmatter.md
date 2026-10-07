---
type: regex
target: { source: file, path: openspec/changes/add-csv-export/plan/parts/01.md }
flags: m
pattern: '^-{3}$(?=[\s\S]*^id: "01"$)(?=[\s\S]*^depends-on:)(?=[\s\S]*^isolation: (?:worktree|shared)$)(?=[\s\S]*^files:)'
---
