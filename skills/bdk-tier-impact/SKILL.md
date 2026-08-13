---
name: bdk-tier-impact
description: Tool-tier guidance for impact analysis (blast radius, affected flows). Preloaded into agents that reason about change impact; not user-facing.
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/impact.chain.json`
