---
name: wrapper-old-rule
description: Host probe. Tests whether the allowed-tools rule of the allowed probe (unquoted path, no echo rule) pre-approves the exact content-wrapper form of kernel-cli (quoted path, 2>&1, $? in the echo branch).
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)
---

Probe skill `wrapper-old-rule` loaded.

Wrapper block output: !`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ping 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Report the block output above exactly as you see it, prefixed `WRAPPER=`, then stop.
