---
schema: 1
id: "01"
title: Problem details only
goal: parseApiProblem returns a JSON body only when it is problem details.
success-measure: The http tests pass, with a gateway-body case.
do-not-touch: ["src/ui/**"]
depends-on: []
spec-impact: [api-errors]
---

## 01-1 Accept only problem details as a problem body

parseApiProblem in src/api/http.ts returns any JSON body as problem details, so a gateway's own JSON on a 5xx hides that the backend is unreachable. Return the body only when it is an object with a string `title` or a numeric `status`, and undefined for any other JSON value. The debug logging test feeds a body with only `message` and `messageKey`; give that fixture a `status` so it stays problem details.

**Files:**

- `src/api/http.ts`
- `src/api/http.test.ts`
- `src/api/debugLogging.test.ts`

**Test cases:**

- a JSON body `{"error":"upstream timeout"}` gives undefined
- a body with `title` and `status` is returned as problem details
- a non-JSON content type still gives undefined
- the debug logging test passes with its fixture carrying `status: 400`
