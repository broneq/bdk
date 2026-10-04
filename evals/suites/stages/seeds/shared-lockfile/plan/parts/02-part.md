---
schema: 1
id: "02"
title: Problem equality
goal: sameProblem tells whether two API problem responses are deeply equal.
success-measure: The problemEquality tests pass.
do-not-touch: ["src/ui/**"]
depends-on: []
spec-impact: none
isolation: worktree
isolation-reason: both parts add a dependency with npm install, which rewrites package.json and package-lock.json
---

## 02-1 Compare problem responses deeply

Add fast-deep-equal as a direct dependency with `npm install fast-deep-equal`. `sameProblem(a: ApiProblemResponse | undefined, b: ApiProblemResponse | undefined): boolean` in a new `src/api/problemEquality.ts`, with `ApiProblemResponse` from `src/api/http.ts`, returns whether both are deeply equal with fast-deep-equal; two undefined values are equal.

**Files:**

- `src/api/problemEquality.ts`
- `src/api/problemEquality.test.ts`

**Test cases:**

- two problems with the same fields, nested ones included, are equal
- problems that differ in one nested field are not equal
- a problem and undefined are not equal; two undefined values are equal
