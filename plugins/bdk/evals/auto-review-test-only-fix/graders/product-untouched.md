---
type: regex
target: { source: file, path: src/parse.js }
pattern: 'Number\(amt\.replace\("\.", ""\)\)'
---

The fix pass changed the test, not the product: the parse code is as round 1 left it.
