---
type: regex
target: { source: file, path: .git/logs/refs/heads/dated-entries }
flags: i
pattern: 'commit: [^\n]*wave[ -]?1'
---

The lead committed the repair on the Change branch with a message that names wave 1.
