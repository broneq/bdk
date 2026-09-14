---
name: bdk-rules-code-quality
description: "Code-quality principles (language-agnostic). Used by agents that write or review code - preloaded via skills: frontmatter, not user-facing."
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py code-quality`
