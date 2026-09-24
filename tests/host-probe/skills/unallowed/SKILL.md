---
name: unallowed
description: Host probe. Control for the allowed skill - the same commands with no allowed-tools, to show what happens without a pre-approval rule.
---

Probe skill `unallowed` loaded.

Plain block output: !`node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping`

Compound block output: !`node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping || echo "BDK STOP: kernel unavailable"`

Do these two steps, then stop:

1. Report the two block outputs above exactly as you see them, one per line, prefixed `PLAIN=` and `COMPOUND=`.
2. Run this exact command with the Bash tool and report its output prefixed `TOOL=`:

   node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping || echo "BDK STOP: kernel unavailable"
