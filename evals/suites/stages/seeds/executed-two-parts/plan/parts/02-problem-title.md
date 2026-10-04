---
schema: 1
id: "02"
title: Problem title in load errors
goal: A load error of an API request shows the problem's title when it has one.
success-measure: The asyncState tests pass, with the title cases.
do-not-touch: ["src/api/**"]
depends-on: ["01"]
spec-impact: none
---

## 02-1 Show the problem title as the load error message

createLoadError in src/ui/asyncState.ts takes the error's message. For an ApiRequestError whose problem details carry a title that is not blank, use the trimmed title as the message instead, whatever the response status; in every other case keep the current message. Part 01 decides which bodies are problem details.

**Files:**

- `src/ui/asyncState.ts`
- `src/ui/asyncState.test.ts`

**Test cases:**

- a problem title `' Not allowed '` gives the message `Not allowed`
- a blank title keeps the error's message
- an ApiRequestError without problem details keeps its message
- a problem with only a status keeps the error's message
- a value that is not an Error gives the fallback
