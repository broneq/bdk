---
type: regex
target: { source: file, path: src/ledger.js }
pattern: 'TypeError[\s\S]*has no date'
---

The repair keeps part 01's rule: balance() still rejects an entry without a date.
