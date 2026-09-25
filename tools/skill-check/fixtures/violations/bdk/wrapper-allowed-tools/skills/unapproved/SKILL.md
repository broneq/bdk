---
name: unapproved
description: Checks a release note. Use when release notes change.
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill unapproved 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

Follow the context the kernel printed.
