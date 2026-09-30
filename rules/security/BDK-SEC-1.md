---
schema: 1
id: BDK-SEC-1
kind: house
severity: high
origin: bdk
since: 2026-09-30
---

**Trust boundaries.** Treat all data crossing into the system from outside - user input, request bodies, query params, headers, file contents, third-party API responses - as untrusted until validated. Validate shape, type, and range at the boundary; trust it thereafter. This is the security half of the "validate at boundaries" code-quality rule.
