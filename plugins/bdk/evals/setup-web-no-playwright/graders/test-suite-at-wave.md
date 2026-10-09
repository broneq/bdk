---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*-\s*id:[^\n]*(?=(?:\n(?!\s*-\s*id:|\s*(?:test|lint|build|e2e):\s*$)[^\n]*)*?\n\s*command:\s*["'']?pnpm (?:run )?test["'']?\s*$)(?=(?:\n(?!\s*-\s*id:|\s*(?:test|lint|build|e2e):\s*$)[^\n]*)*?\n\s*when:\s*(?:\[[^\]\n]*\bwave\b|(?:\n\s*-\s*\w+)*?\n\s*-\s*wave\b))'
---

The item `command: pnpm test` runs at the `wave` point.
