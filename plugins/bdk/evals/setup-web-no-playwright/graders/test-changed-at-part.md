---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*-\s*id:[^\n]*(?=(?:\n(?!\s*-\s*id:|\s*(?:test|lint|build|e2e):\s*$)[^\n]*)*?\n\s*command:\s*["'']?[^\n]*vitest[^\n]*\{files\})(?=(?:\n(?!\s*-\s*id:|\s*(?:test|lint|build|e2e):\s*$)[^\n]*)*?\n\s*when:\s*(?:\[\s*part\s*\]|\n\s*-\s*part\s*$(?!\n\s*-\s*\w)))'
---

A `tools.test` item runs vitest on `{files}` with `when: [part]`.
