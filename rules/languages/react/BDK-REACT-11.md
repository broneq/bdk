---
schema: 1
id: BDK-REACT-11
kind: house
paths:
  - "**/*.jsx"
  - "**/*.tsx"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Component size measured in responsibilities, not lines.** Split when a component juggles distinct concerns (fetching + form + layout + animation) or when it resists a clean name. Premature extraction harms colocation; a long component with one clear job is healthier than five tightly-coupled fragments.
