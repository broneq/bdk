---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*timeout:\s*(?:9\d\d|[1-9]\d{3,})\s*$'
---

The wrapper's 900 s budget is over the default 600 s timeout: an item carries a timeout of at least 900.
