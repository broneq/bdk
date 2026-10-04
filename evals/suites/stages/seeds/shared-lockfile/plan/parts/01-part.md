---
schema: 1
id: "01"
title: Relative timestamps
goal: formatRelativeTimestamp renders a timestamp relative to now.
success-measure: The relativeTime tests pass.
do-not-touch: ["src/api/**"]
depends-on: []
spec-impact: none
---

## 01-1 Format a timestamp relative to now

Add dayjs as a direct dependency with `npm install dayjs`. `formatRelativeTimestamp(value: string | undefined, now: Date = new Date(), fallback = 'Unknown')` in a new `src/ui/relativeTime.ts` returns the text of dayjs's relativeTime plugin for `value` seen from `now`, `fallback` for a missing or blank value, and an unparseable value verbatim.

**Files:**

- `src/ui/relativeTime.ts`
- `src/ui/relativeTime.test.ts`

**Test cases:**

- a value two hours before `now` gives `2 hours ago`
- a value three days after `now` gives `in 3 days`
- `formatRelativeTimestamp(undefined)` and `formatRelativeTimestamp('  ')` give `Unknown`
- `formatRelativeTimestamp('not a date')` gives `not a date`
