---
type: llm
focus: { source: file, path: src/slugify.js }
---

Judge the behaviour of this slugify function, not its technique: Unicode normalisation, a lookup table or a regex are all fine.

PASS if, traced by hand, it returns lowercase words joined by single hyphens, turns `Zażółć gęślą jaźń` into `zazolc-gesla-jazn` (including `ł` to `l`, which NFD normalisation alone does not do), never returns a leading or trailing hyphen, and keeps results of more than 60 characters to at most 60 by dropping whole words.
FAIL if any of these results would be wrong.
