---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*start:\s*["'']?[^\n]*\b3100\b'
---

The E2E start runs the server the way the global setup does, on port 3100, not `pnpm dev`.
