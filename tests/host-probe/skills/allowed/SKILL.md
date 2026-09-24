---
name: allowed
description: Host probe. Tests whether an allowed-tools rule for the kernel binary pre-approves the compound "node ... || echo ..." wrapper, both in a ! block and in a Bash tool call.
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)
---

Probe skill `allowed` loaded.

Plain block output: !`node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping`

Compound block output: !`node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping || echo "BDK STOP: kernel unavailable"`

Do these two steps, then stop:

1. Report the two block outputs above exactly as you see them, one per line, prefixed `PLAIN=` and `COMPOUND=`.
2. Run this exact command with the Bash tool and report its output prefixed `TOOL=`:

   node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping || echo "BDK STOP: kernel unavailable"
