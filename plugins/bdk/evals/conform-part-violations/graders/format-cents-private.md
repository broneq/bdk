---
type: regex
target: { source: file, path: src/csv.js }
pattern: '^(?![\s\S]*export\s+(?:function\s+formatCents|\{[^}]*formatCents))[\s\S]*function formatCents'
---
