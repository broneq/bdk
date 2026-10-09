---
description: "/bdk:execute called with a part id (add-csv-export 01) builds nothing: no bdk:lead starts, no file is edited, and the reply names /bdk:implement-part add-csv-export 01 for one part and /bdk:execute add-csv-export for the whole plan."
tags: [orchestrator, writes-nothing]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

Run the skill bdk:execute with the arguments: add-csv-export 01
