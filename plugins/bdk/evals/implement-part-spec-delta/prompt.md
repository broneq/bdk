---
description: "implement-part, on the bdk:implementer agent, builds fix part 01 of round 1 of add-total, whose only task adds the bad-amount error to the tally spec delta (verified by the next round's spec check): it edits the delta, writes no test, and reports done instead of a plan defect."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Implement fix part 01 of the change add-total; the fix parts are in .bdk/runs/add-total/review/round-1/fixes/parts.
