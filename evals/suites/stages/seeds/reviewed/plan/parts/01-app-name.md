---
schema: 1
id: "01"
title: The app name constant
goal: src/app-name.ts exports APP_NAME.
success-measure: APP_NAME is the string "Operator".
do-not-touch: []
depends-on: []
spec-impact: none
---

## 01-1 Export APP_NAME

`src/app-name.ts` exports `APP_NAME`, the string `"Operator"`.

**Files:**

- `src/app-name.ts`

**Test cases:**

- `APP_NAME` is `"Operator"`
