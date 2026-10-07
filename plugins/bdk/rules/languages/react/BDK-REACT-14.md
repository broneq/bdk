---
kind: knowledge
paths:
  - "**/*.jsx"
  - "**/*.tsx"
stages:
  - plan
  - execute
  - review
source: "https://react.dev/reference/react/useEffectEvent"
verified: 2026-09-30
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: languages/react.15.fd4c706b
  class: corrects the model
---

**`useEffectEvent` over refs for latest-value handlers.** When an Effect must call a callback with fresh props/state but should not re-run on each change, use `useEffectEvent` - never list it in a dependency array and never pass it across component boundaries.
