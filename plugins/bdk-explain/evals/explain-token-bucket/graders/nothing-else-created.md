---
type: regex
target: files
flags: m
match: not_contains
pattern: '^(?!\.bdk/tmp/)\S'
---

Every file the run created lies under .bdk/tmp/, so git status stays clean.
