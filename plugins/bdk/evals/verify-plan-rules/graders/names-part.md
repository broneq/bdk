---
type: regex
target: { source: file, path: .bdk/runs/add-csv-export/plan/verify-1.md }
flags: m
pattern: '^- M\d+ [^\n]*(?:\b01\b[^\n]*\bAPI-DOC-1\b|\bAPI-DOC-1\b[^\n]*\b01\b)'
---

The item that names API-DOC-1 is about part 01, which adds the exported `toCsv` in `src/csv.js` with no `docs/api.md` task.
