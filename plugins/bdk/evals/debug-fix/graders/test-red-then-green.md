---
type: regex
target: { source: file, path: .bdk/runs/fix-total-crash/execute/part-01.md }
pattern: '^Status: done\n\n## Acceptance tests\n(?:- [^\n]*; red seen; green seen\n)+\n## Changed files'
---

The acceptance signal: the reproduction test was seen red before the fix and green after it. Every acceptance line ends in exactly that form; a note in it means a red that was not seen (#262).
