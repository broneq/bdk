# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## Tool Tier System

When exploring, searching, editing, or reviewing code, use the best available tool tier. The instructions below are injected based on your project's enabled features.

**Exploration & Architecture:**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

**Symbol Search & Tracing:**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

**Impact Analysis:**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/impact.chain.json`
