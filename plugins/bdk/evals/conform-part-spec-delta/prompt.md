---
description: "conform-part, on the bdk:conformer agent, checks fix part 01 of round 1 of add-total, which only added the bad-amount error to the tally spec delta and has no test (verified by the next round's spec check): Verdict PASS, no Left item for task 1."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Fix part 01 of the change add-total is implemented but not committed yet; the fix parts are in .bdk/runs/add-total/review/round-1/fixes/parts. Before I commit it, check that it follows our rules, the project instructions and the part's tasks.
