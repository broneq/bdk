---
schema: 1
id: BDK-REACT-1
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Server Components by default.** Keep `"use client"` boundaries small and push them deep into the tree. Interactive islands stay isolated; the rest renders server-side so less JS ships to the client.
