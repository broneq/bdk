---
name: bdk-rules-architecture
description: "Architecture principles (layering, boundaries, dependency direction). Used by agents that reason about structure - preloaded via skills: frontmatter, not user-facing."
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py architecture`
