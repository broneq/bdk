---
name: bdk-implementer-return-contract
description: >-
  Preloads the implementer/fixer YAML return-contract schema into an agent's
  context. Not user-invocable — preloaded via skills: frontmatter on implementer
  and fixer agents.
user-invocable: false
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-implementer-return-contract 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: bdk-implementer-return-contract" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill bdk-implementer-return-contract` first and apply its output; on a `BDK STOP` line, stop and report it.

# Implementer Return Contract

The schema is the `Return contract` section of the BDK context above.
