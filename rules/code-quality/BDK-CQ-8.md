---
schema: 1
id: BDK-CQ-8
kind: house
paths:
  - "**"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Async pipeline observability.** If a feature spans an async pipeline (work crossing process/time boundaries - queue, worker, webhook chain) with ≥2 distinct external failure modes (auth, third-party API, parser, downstream mutation, queue), emit one structured log per state transition. Minimum shape: `event`, identifying id, outcome (`started` / `succeeded` / `failed:<reason>`). Without it, prod failures triage blind.
