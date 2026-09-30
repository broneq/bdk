---
schema: 1
id: BDK-REACT-6
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Composition beats Context for prop drilling.** When tempted to pipe a prop through layers, restructure with `children` / slot props instead. Context is a global broadcast, not a shortcut around component design.
