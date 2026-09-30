---
schema: 1
id: BDK-REACT-18
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**`<ViewTransition>` is an enhancement, not a routing primitive.** Reach for it only when morphing shared elements adds perceived polish (gallery, dashboard tab swap). Wrapping every route transition adds animation cost and complexity without UX gain.
