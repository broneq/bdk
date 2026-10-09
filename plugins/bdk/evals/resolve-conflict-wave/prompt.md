---
description: "resolve-conflict --wave, on the bdk:implementer agent, repairs the red wave check of dated-entries: part 01 made balance() reject an entry without a date, part 02's summary test builds undated entries; the test is dated, part 01's rule is kept, the wave check passes, nothing is committed, and execute/wave-1.md is written."
tags: [block]
max_turns: 60
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit, Bash]
---

Both parts of wave 1 of the change dated-entries are on the branch, but the wave check `checks/wave-1.json` is red. Repair the wave; its base is the commit in `.bdk/runs/dated-entries/state.json`.
