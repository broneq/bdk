---
schema: 1
id: "02"
title: Gateway errors
goal: A 5xx whose JSON body is not problem details is a backend-unavailable error.
success-measure: The http tests pass, with a gateway-body case.
do-not-touch: ["src/ui/**"]
depends-on: []
spec-impact: none
---

## 02-1 Accept only problem details as a problem body

parseApiProblem in src/api/http.ts returns any JSON body as problem details. Return the body only when it is an object with a string `title` or a numeric `status`, and undefined otherwise. The debug logging test feeds a body with only `message` and `messageKey`; give that fixture a `status` so it stays problem details.

**Files:**

- `src/api/http.ts`
- `src/api/http.test.ts`
- `src/api/debugLogging.test.ts`

**Test cases:**

- a JSON body `{"error":"upstream timeout"}` gives undefined
- a body with `title` and `status` is returned as problem details
- a non-JSON content type still gives undefined
- the debug logging test passes with its fixture carrying `status: 400`
