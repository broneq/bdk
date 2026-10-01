---
schema: 1
id: "01"
title: Blank timestamps
goal: formatTimestamp returns the fallback for a whitespace-only value.
success-measure: The format tests pass, with a whitespace-only case.
do-not-touch: ["src/api/**"]
depends-on: []
spec-impact: none
---

## 01-1 Fall back on a whitespace-only timestamp

formatTimestamp in src/ui/format.ts takes the fallback only for an empty value; a whitespace-only value reaches `new Date` and comes back verbatim. Trim the value before the empty check.

**Files:**

- `src/ui/format.ts`
- `src/ui/format.test.ts`

**Test cases:**

- `formatTimestamp('   ')` returns `Unknown`
- `formatTimestamp('   ', 'n/a')` returns `n/a`
- a valid ISO timestamp is still formatted
