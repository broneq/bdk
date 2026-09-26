---
name: commit
description: Generate conventional commit message based on git changes
model: haiku
argument-hint: "[scope] (e.g. 'from main', 'only src/foo.py')"
disable-model-invocation: true
hooks:
  UserPromptSubmit:
    - hooks:
        - type: command
          command: 'node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks skill-exists caveman-commit 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."'
          once: true
---

Invoke `/caveman:caveman-commit $ARGUMENTS`.
