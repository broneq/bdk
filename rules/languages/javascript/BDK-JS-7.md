---
schema: 1
id: BDK-JS-7
kind: knowledge
severity: medium
origin: bdk
since: 2026-09-30
source: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN"
verified: 2026-09-30
---

**Mind the classic foot-guns.** Floating-point equality (`0.1 + 0.2 !== 0.3`), `NaN !== NaN` (use `Number.isNaN`), mutating a collection mid-iteration, and `this` rebinding in detached methods or callbacks all produce silent wrong answers. Use arrow functions or explicit binding to keep `this` stable.
