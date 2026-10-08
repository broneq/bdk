---
type: regex
target: { source: file, path: src/ledger.js }
pattern: '^(<<<<<<<|=======|>>>>>>>)'
flags: m
match: not_contains
---
