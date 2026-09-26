---
name: bdk-rules-languages
description: Language-specific rules resolved from `languages` in the BDK settings. Preloaded into agents that write or review code; not user-facing.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-languages 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: bdk-rules-languages" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-rules-languages` first and apply its output; on a `BDK STOP` line, stop and report it.

Apply every `Language rules: <language>` section of the BDK context above. Without one, no language in `languages` has rules.
