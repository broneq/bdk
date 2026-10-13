---
type: regex
target: { source: file, path: .bdk/settings.yaml }
flags: m
pattern: '^\s*start:\s*["'']?[^\n]*profiles?[^\n]*\be2e\b|^\s*SPRING_PROFILES_ACTIVE:\s*["'']?e2e\b'
---

The E2E start runs the app with the `e2e` profile (in-memory H2), not the default profile that needs PostgreSQL.
