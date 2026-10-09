---
type: regex
target: { source: file, path: .bdk/runs/add-csv-export/execute/part-01.md }
pattern: '## Acceptance tests\n(?:- [^\n]*; red seen; green seen\n){4,}\n## Changed files'
---

Every acceptance line ends in exactly `; red seen; green seen`; a note in it means a red that was not seen (#262).
