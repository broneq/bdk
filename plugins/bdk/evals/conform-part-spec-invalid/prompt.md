---
description: "conform-part, on the bdk:conformer agent, checks fix part 01 of round 1 of add-total, whose implementer added the requirement Bad amount to the tally spec delta without the scenario task 1 names, and reported done: openspec validate --strict refuses the delta, so the verdict is FAIL with task 1 under Left, and the conformer does not write the scenario itself (#373)."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Fix part 01 of the change add-total is implemented but not committed yet; the fix parts are in .bdk/runs/add-total/review/round-1/fixes/parts. Before I commit it, check that it follows our rules, the project instructions and the part's tasks.
