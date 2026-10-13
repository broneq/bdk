---
type: regex
target: { source: file, path: .gitignore }
flags: m
pattern: '^/?\.bdk/notes(?:/\*{0,2})?\s*$'
---

The untracked `.bdk/notes/` the v2 `/.bdk/` rule hid gets an ignore line of its own.
