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
## 01-1 Token table

**Files:**

- Create: `src/auth/token-store.ts`
- Test: `src/auth/token-store.test.ts`

**Test cases:**

- a consumed token cannot be consumed again
