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
          command: "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/is-skill-exist/check.py caveman-commit"
          once: true
---

Invoke `/caveman:caveman-commit $ARGUMENTS`.
