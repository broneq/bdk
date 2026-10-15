---
description: "/bdk:run on a queue whose first Change holds an open needs-user scope-log entry: run.json marks it needs-user, no stage runs for it, and the second Change (add-count) goes on to its pull request."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Carry on with the queued run of changes: take each one through to its pull request.
