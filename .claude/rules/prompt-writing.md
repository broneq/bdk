---
description: How BDK writes model-facing prose (skills, role contracts, adapters) for Claude Opus 5 and 5.5
paths:
  - "skills/**"
  - "agents/**"
---

# Writing Prompts for Current Models

Skills, role contracts and adapters are read by Claude Opus 5 and 5.5 and the Sonnet of the same generation; the `runner` and `scout` adapters run on Haiku 4.5, one generation older (HOST-FACTS `model-override`). These models follow instructions literally and verify their own work, so text written for older models over-steers them. The same principles apply to the instructions the kernel renders (`next`, dispatch templates, hook reasons). `.claude/rules/skills.md` holds the checks `pnpm skill-check` enforces; this file holds what no check can see.

Sources: "Prompting Claude Opus 5" and "Prompting Claude Opus 5.5" (platform.claude.com, build-with-claude/prompt-engineering).

## Give the whole task up front, not a step script

State the goal, the constraints and when the work is done, then let the model plan. The kernel holds the order (`next`, `attempt close` `next.action`); the prose does not repeat it as numbered steps.

> Deliver the tasks of part 02 as committed tasks. Constraints: only the `Files:` of each task, nothing in `do-not-touch`. Done when every task of the part is committed and your report is stored.

## Leave verification to the kernel

Write no "double-check", "verify before finishing" or "make sure you tested" sentences. The model already checks its work, and extra prompting makes it over-check. BDK verifies through gates, evidence and `attempt close`; name the command that decides, not the habit.

> `bdk attempt close` decides whether the evidence suffices; act on its `next.action`.

## Name the early stops to avoid

These models tend to end a turn with a progress report that announces the next step. Name that stop, and say which stops are wanted. The `Stop` and `SubagentStop` continuation checks back this up.

> End your turn only to ask the user a question the Change cannot answer or to report a blocker. A turn that ends with "next I will ..." while work is ready is not done.

## State the scope for an implementer

The model widens a task when nothing bounds it: extra refactors, helpers, options. One sentence bounds it.

> Deliver what the task asks, at the size it asks for; put anything else you notice into a `finding`.

## Reviewers report everything; filtering happens elsewhere

"Report only important issues" is followed literally and hides findings. Ask for every finding with its severity; the P8 categories and the kernel decide what blocks.

> Report every finding with a severity and a category from your package. Do not drop a finding because it seems minor.

## Calibrate the length of written documents

These models write longer files than their predecessors. Give the length the document needs, next to the kernel limit.

> `design.md` covers the decisions and their reasons in at most about two pages; the kernel refuses a design over 12 KB.

## Delegate only sizeable, independent work

These models start subagents readily, and a subagent for a small task costs several times the task. Say when delegation is warranted, and let the kernel's tree rule and the adapter's `Agent(...)` list bound it.

> Start a scout only for a search across more than a few files that you would otherwise read yourself.

## Prefer a positive example to a prohibition

Show the wanted form once instead of listing what not to do, and write without capitals for emphasis: the model follows plain instructions exactly, and shouting makes it overreact. Keep a prohibition only where the reason is a hard boundary, and give the reason in the same sentence (T3: "no git command that discards work; return `blocked` with the cause instead").
