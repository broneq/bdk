---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*command:\s*["'']?(?:bash\s+)?(?:\./)?scripts/e2e\.sh'
---

The Cypress suite runs through `scripts/e2e.sh`.
