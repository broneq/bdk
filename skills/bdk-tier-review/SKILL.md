---
name: bdk-tier-review
description: "Tool-tier guidance for code review (change detection, risk scoring, review context). Used by reviewer subagents - preloaded via skills: frontmatter, not user-facing."
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/review.chain.json`
