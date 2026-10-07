---
type: regex
pattern: '^(?![\s\S]*^\s*(classDef|style)\s[^\n]*fill:(?!\s*transparent)(?![^\n]*stroke:[^\n]*color:|[^\n]*color:[^\n]*stroke:)[^\n]*$)[\s\S]*(fill:|rect rgba?\()'
flags: m
---

The failure paths are coloured (a `classDef`/`style` fill or a tinted `rect`), and every coloured node sets `fill`, `stroke` and `color` together, so its label stays legible in dark mode.
