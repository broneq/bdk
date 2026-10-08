---
description: "/bdk:run on a queue whose second Change (issue 2) is blocked by the first: add-total gets PR 1, the second Change is not started and is reported as waiting on add-total."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Carry on with the queued run of changes: take each one through to its pull request.
