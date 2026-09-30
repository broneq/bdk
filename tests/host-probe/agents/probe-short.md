---
name: probe-short
description: Host probe subagent limited to one turn, to record whether SubagentStop fires when an agent is cut off by maxTurns. Use only when a probe step asks for it.
tools: Bash
model: haiku
maxTurns: 1
---

Run these three commands with the Bash tool, one call each, in order: echo short-1, echo short-2, echo short-3. Then reply with `PROBE-SHORT-DONE`.
