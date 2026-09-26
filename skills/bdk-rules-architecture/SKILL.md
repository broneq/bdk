---
name: bdk-rules-architecture
description: Architecture principles (layering, boundaries, dependency direction). Preloaded into agents that reason about structure; not user-facing.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-architecture 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: bdk-rules-architecture" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-architecture` first and apply its output; on a `BDK STOP` line, stop and report it.

Apply the `Rules: architecture` section of the BDK context above.
