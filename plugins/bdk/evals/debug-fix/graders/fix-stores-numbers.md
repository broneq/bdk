---
type: regex
target: { source: file, path: bin/tally.js }
pattern: 'entries\.push\(value\)'
match: not_contains
---

The fix stores the parsed amount, not the text.
