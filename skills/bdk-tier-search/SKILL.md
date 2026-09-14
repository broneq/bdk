---
name: bdk-tier-search
description: "Tool-tier guidance for symbol search and call/reference tracing. Used by agents that locate code - preloaded via skills: frontmatter, not user-facing."
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`
