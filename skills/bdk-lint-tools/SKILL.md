---
name: bdk-lint-tools
description: Project-configured lint/format/typecheck commands from .bdk/settings.json. Preloaded into agents that run static analysis; not user-facing.
user-invocable: false
---

Lint/format/typecheck command(s) for this project: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

Run the command(s) above. Prefer a project script (`bin/cleanup.sh`, `Makefile` `lint` target) when present. If the line above reads `run the project's linter/formatter`, `.bdk/settings.json` is not configured — emit one warning line `[bdk] .bdk/settings.json not configured — run /bdk:setup` then detect from project files and proceed.
