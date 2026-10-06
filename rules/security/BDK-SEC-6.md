---
schema: 1
id: BDK-SEC-6
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

**Least privilege.** Grant the narrowest scope that works - DB roles, API tokens, file permissions, IAM policies. Default-deny; widen only with justification. A component compromised with narrow privilege does bounded damage.
