---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?[^\n]*(?:run-e2e\.sh|test:e2e)'
---

The Playwright suite runs through its wrapper (`scripts/run-e2e.sh` or `pnpm test:e2e`).
