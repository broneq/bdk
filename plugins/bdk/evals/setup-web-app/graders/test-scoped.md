---
type: regex
target: { source: file, path: .bdk/settings.yaml }
pattern: 'command:\s*["'']?pnpm (run )?test["'']?\s*\n\s*scoped:\s*["'']?[^\n]*\{files\}|scoped:\s*["'']?[^\n]*vitest[^\n]*\{files\}'
---
