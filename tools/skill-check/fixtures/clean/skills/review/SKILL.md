---
name: review
description: Reviews a change against the project rules. Use when a change is ready for review.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill review 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Review the change, then hand the verdict to /bdk:plan. Dispatch the second opinion with `subagent_type: bdk:reviewer`.
