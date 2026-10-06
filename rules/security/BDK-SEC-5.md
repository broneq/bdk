---
schema: 1
id: BDK-SEC-5
kind: house
paths:
  - "**"
stages:
  - design
  - execute
  - review
severity: high
origin: bdk
since: 2026-09-30
---

**Authentication vs authorisation.** Authenticate once at the edge; authorise on every privileged action. Check that _this_ principal may act on _this_ resource at the point of use - never infer authorisation from a prior auth step or a hidden client-side field.
