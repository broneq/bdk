---
type: regex
target: { source: file, path: bin/tally.js }
pattern: 'console\.error\(`tally: \$\{error\.message\}`\)'
---

The part changes spec text only; the code keeps its error.
