---
schema: 1
id: BDK-SEC-8
kind: house
severity: high
origin: bdk
since: 2026-09-30
---

**Sensitive data exposure.** Do not return more than the caller needs - strip internal fields, stack traces, and version banners from responses. Errors shown to users say what failed, not how the system is built.
