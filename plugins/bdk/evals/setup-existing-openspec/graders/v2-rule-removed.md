---
type: regex
target: { source: file, path: .gitignore }
flags: m
pattern: '^(?![\s\S]*^/?\.bdk/?\s*$)[\s\S]*\.bdk/runs/'
---
