---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?(?:pnpm (?:run )?build|[^\n]*deploy)'
match: not_contains
---

No item runs the `build` script, which deploys to production.
