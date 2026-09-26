---
name: legacy
description: Checks a release note. Use when release notes change.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)
---

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.x --then f.md`

Follow the injected fragment.
