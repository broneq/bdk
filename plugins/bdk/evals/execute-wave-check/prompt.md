---
description: "/bdk:execute resumes dated-entries after both parts of wave 1 were committed and before the wave check ran (part 01: balance() rejects an undated entry; part 02: a summary whose test builds undated entries): the wave check fails, resolve-conflict --wave dates the summary test, the lead commits the repair, marks wave 1 done in state.json and writes ## Waves in the result."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

Continue building the change dated-entries.
