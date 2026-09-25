---
name: locked
description: Host probe. Tests that disallowed-tools removes edit tools while the skill is active and whether they come back on the next user message.
disallowed-tools: Edit Write NotebookEdit
---

Probe skill `locked` loaded. Do these two steps, then stop:

1. Say whether the tools `Edit`, `Write` and `NotebookEdit` are in your tool list right now, as `LOCKED-TOOLS Edit=<yes|no> Write=<yes|no> NotebookEdit=<yes|no>`.
2. Try to create the file `probe-locked.txt` containing `locked` with the Write tool. Report `LOCKED-WRITE=<done|unavailable|denied>`.
