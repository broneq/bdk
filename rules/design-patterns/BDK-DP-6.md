---
schema: 1
id: BDK-DP-6
kind: house
paths:
  - "**"
stages:
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Tell-Don't-Ask.** Behaviour lives with data. A `Document` object exposes `document.line(5).text()`; do not scatter helpers like `get_line_text(parse(src), 5)` that pull state out and operate on it externally. Counters Anemic model.
