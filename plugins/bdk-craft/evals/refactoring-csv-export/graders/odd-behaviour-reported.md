---
type: llm
---

PASS if the reply points out that a name containing a double quote produces invalid CSV (quotes are not escaped), and leaves it unchanged as a separate decision or question.
FAIL if the reply does not mention it, or says it changed that behaviour.
