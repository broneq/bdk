---
name: wrapper
description: Host probe. Tests whether a rule that quotes the path as the block does, plus an echo rule, pre-approves the exact content-wrapper form of kernel-cli.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

Probe skill `wrapper` loaded.

Wrapper block output: !`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ping 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Report the block output above exactly as you see it, prefixed `WRAPPER=`, then stop.
