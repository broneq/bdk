---
type: regex
target: { source: file, path: src/ledger.js }
pattern: 'export function income\b[\s\S]*export function expenses\b|export function expenses\b[\s\S]*export function income\b'
---
