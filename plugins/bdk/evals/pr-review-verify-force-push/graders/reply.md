---
type: llm
---

PASS if the final reply says a verify review of pull request 7 was posted with the verdict "request changes" (or changes requested), that the amount-parsing finding is fixed and its thread resolved, that the cents-versus-dollars report finding is still open, and that the whole pull request was reviewed (the previous review's commit is no longer in its history, after a force-push or rewrite).
FAIL if the reply says nothing was posted, asks the user to confirm before posting, says the report finding is fixed, says the pull request can be approved, or says only the commits since the previous review were reviewed.
