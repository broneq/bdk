---
name: bdk-tier-review
description: Tool-tier guidance for code review (change detection, risk scoring, review context). Preloaded into reviewer subagents; not user-facing.
user-invocable: false
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/review.chain.json`
