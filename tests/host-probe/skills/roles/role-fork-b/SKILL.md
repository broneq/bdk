---
name: role-fork-b
description: Host probe. Forked role skill on a plugin adapter; records which agent runs it and whether its ! block resolved before the fork. Use only when a probe step asks for it.
context: fork
agent: bdk-probe:probe-reader
allowed-tools: Bash(echo *) Bash(sleep *)
---

Rendered marker: !`echo FORK-BANG-RESOLVED`

Do exactly this:

1. Run with the Bash tool: sleep 8
2. Run with the Bash tool: echo role-fork-b-ran
3. Reply with one line: ROLE-FORK-B marker=<the rendered marker line above, verbatim>
