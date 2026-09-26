---
name: bdk-rules-code-quality
description: Code-quality principles (language-agnostic). Preloaded into agents that write or review code; not user-facing.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-code-quality 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: bdk-rules-code-quality" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-code-quality` first and apply its output; on a `BDK STOP` line, stop and report it.

Apply the `Rules: code-quality` section of the BDK context above.
