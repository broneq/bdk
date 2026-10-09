---
description: "/bdk:auto-review on monthly-report from a judged round 1 whose E2E check passed and whose only finding to fix is a test gap: the fix pass changes only src/parse.test.js, so round 2 runs no E2E check, carries round 1's verdict over and says why in round.md."
tags: [orchestrator]
max_turns: 120
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

Round 1 of the review of the monthly-report change is judged. Finish the review.
