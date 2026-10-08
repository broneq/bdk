---
description: "/bdk:run continues a queue of two reviewed Changes: close for add-total, then for add-count, each on its own branch, ending with two PRs into main."
tags: [orchestrator]
max_turns: 120
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Carry on with the queued run of changes: take each one through to its pull request.
