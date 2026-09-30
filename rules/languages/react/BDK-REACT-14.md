---
schema: 1
id: BDK-REACT-14
kind: knowledge
severity: medium
origin: bdk
since: 2026-09-30
source: "https://react.dev/reference/react/useEffectEvent"
verified: 2026-09-30
---

**`useEffectEvent` over refs for latest-value handlers.** When an Effect must call a callback with fresh props/state but should not re-run on each change, use `useEffectEvent` - never list it in a dependency array and never pass it across component boundaries.
