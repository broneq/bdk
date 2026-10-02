---
name: ro-stage
description: Host probe. A read-only stage-like skill (disallowed-tools Edit Write NotebookEdit) started through the Skill tool, to test whether its disallowed-tools apply and whether they still apply to a second skill started in the same turn.
disallowed-tools: Edit Write NotebookEdit
---

Probe skill `ro-stage` loaded. Do these two steps in order, then stop:

1. Use the Write tool to create `probe-write.txt` in the current working directory (not the skill directory) containing `first`. If you have no Write tool, do not look for one; write the line `RO-NO-WRITE`.
2. Call the Skill tool with skill `bdk-probe:writer` and follow what it says.
