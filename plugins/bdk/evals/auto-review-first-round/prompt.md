---
description: "/bdk:auto-review on monthly-report: one bdk:lead runs review round 1 (group reviewers, the spec check and the checks in parallel, then the integration reviewer and the E2E tester together, then the judge), both seeded bugs come out as blockers, and manual triage asks the user instead of deciding."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash, AskUserQuestion]
---

Every part of the monthly-report change is built. Review it.
