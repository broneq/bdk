---
name: bdk-rules-design-patterns
description: Design pattern principles (GoF, anti-patterns, pattern documentation). Preloaded into agents that propose or review code structure; not user-facing.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-design-patterns 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: bdk-rules-design-patterns" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-design-patterns` first and apply its output; on a `BDK STOP` line, stop and report it.

Apply the `Rules: design-patterns` section of the BDK context above.
