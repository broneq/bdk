---
schema: 1
id: BDK-SEC-4
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

**Secrets.** No credentials, tokens, keys, or connection strings in source, logs, error messages, or client-shipped code. Read them from the environment or a secrets manager. A secret that reaches a log or a stack trace is a leaked secret.
