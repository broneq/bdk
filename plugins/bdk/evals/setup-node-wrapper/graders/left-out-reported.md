---
type: llm
---

PASS if the final reply says, each with a reason, that setup does not run both of these: the `build` script (because it deploys to production; listed as left out, or replaced by a build without the deploy such as `next build`, the reason given either way) and the `chromatic` visual test `test:visual` (because it needs a Chromatic project token, the network or the external Chromatic service).
FAIL if either is missing from the reply, or is named without a reason.
