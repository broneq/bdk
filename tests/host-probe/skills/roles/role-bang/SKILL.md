---
name: role-bang
description: Host probe. Inline (not forked) role skill with a ! block; records whether the block resolves when a subagent invokes the skill. Use only when a probe step asks for it.
allowed-tools: Bash(echo *)
---

Rendered marker: !`echo SUB-BANG-RESOLVED`

Reply with one line: ROLE-BANG marker=<the rendered marker line above, verbatim>
