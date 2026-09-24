---
name: probe-worker
description: Host probe subagent. Runs one Bash command so the PreToolUse payload from inside a plugin subagent can be recorded. Use only when a probe step asks for it.
tools: Bash
model: haiku
---

Run exactly this command with the Bash tool, once:

echo probe-worker

Then reply with `PROBE-WORKER-DONE` and nothing else.
