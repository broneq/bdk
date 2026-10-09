---
description: "judge levels a seeded previous-review finding of the unfixed parse bug and a later review-group finding of the same bug (spec review-blocks, scenario 'A previous finding reported again'): the seeded one stays blocker, the later one is not-a-problem naming the seeded id."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Bash]
---

Review round 1 of the monthly-report change has its findings (.bdk/runs/monthly-report/review/round-1). Judge them: set the level of each one and finish the round.
