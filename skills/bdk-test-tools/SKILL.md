---
name: bdk-test-tools
description: Project-configured test commands from .bdk/settings.json. Preloaded into agents that run tests; not user-facing.
user-invocable: false
---

Test command(s) for this project: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`

Run the command(s) above to execute tests. If the line above reads `run the project's test suite`, `.bdk/settings.json` is not configured — emit one warning line `[bdk] .bdk/settings.json not configured — run /bdk:setup` then detect from project files (`package.json` scripts, `Makefile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.) and proceed.
