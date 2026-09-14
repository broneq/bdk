---
name: bdk-tier-edit
description: "Tool-tier guidance for structural code edits and refactors. Used by agents that mutate code - preloaded via skills: frontmatter, not user-facing."
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/edit.chain.json`
