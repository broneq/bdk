---
name: bdk-rules-languages
description: Language-specific rules resolved from `languages` in the BDK settings. Preloaded into agents that write or review code; not user-facing.
user-invocable: false
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-language-rules.py`
