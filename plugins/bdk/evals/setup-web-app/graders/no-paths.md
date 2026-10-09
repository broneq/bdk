---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*-\s*id:[^\n]*(?=(?:\n(?!\s*-\s*id:|\s*(?:test|lint|build|e2e):\s*$)[^\n]*)*?\n\s*paths:)(?!(?:\n(?!\s*-\s*id:|\s*(?:test|lint|build|e2e):\s*$)[^\n]*)*?\n\s*command:[^\n]*\{files\})'
match: not_contains
---

One package: only an item whose command holds `{files}` has `paths`.
