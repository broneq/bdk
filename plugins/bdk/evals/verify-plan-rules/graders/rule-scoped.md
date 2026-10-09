---
type: regex
target: { source: file, path: .bdk/runs/add-csv-export/plan/verify-1.md }
flags: m
pattern: '^- M\d+ [^\n]*(?:\b02\b[^\n]*\bAPI-DOC-1\b|\bAPI-DOC-1\b[^\n]*\b02\b)'
match: not_contains
---

Part 02 changes only `bin/ledger.js`, `test/cli.test.js` and `package.json`, which the rule's `src/**` does not match, so no item says it breaks API-DOC-1.
