---
name: bdk-rules-languages
description: "Language-specific rules resolved from .bdk/settings.json `languages`. Used by agents that write or review code - preloaded via skills: frontmatter, not user-facing."
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-language-rules.py`
