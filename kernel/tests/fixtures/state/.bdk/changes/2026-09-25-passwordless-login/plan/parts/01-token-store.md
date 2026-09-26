---
schema: 1
id: "01"
title: Token store
goal: Single-use tokens with an expiry are stored and consumed atomically.
success-measure: A consumed token cannot be consumed again in a concurrent test.
do-not-touch: []
depends-on: []
spec-impact: none
---
### Task 01-1 Token table
Files: src/auth/token-store.ts, src/auth/token-store.test.ts
