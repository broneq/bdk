---
description: "/bdk:run #1 #2 where issue 1 is blocked by issue 2: run.json queues issue 2 first, its Change gets a branch from main and a proposal named by the run, and the run stops at the manual design gate."
tags: [orchestrator]
max_turns: 120
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, ToolSearch, Write, Edit, Bash]
---

Work through issues #1 and #2 for me, all the way to pull requests.
