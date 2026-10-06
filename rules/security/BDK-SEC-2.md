---
schema: 1
id: BDK-SEC-2
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

**Injection.** Never build interpreted strings (SQL, shell, HTML, LDAP, template, command) by concatenating untrusted input. Use parameterised queries, prepared statements, and library-provided escaping. The rule is structural: data and code must travel in separate channels.
