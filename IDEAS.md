# Ideas to improve workflow

* [ ] Add rules for multi language support (TS, React, Python)
* [ ] Add startup script — check if required skills from other marketplaces installed:
    * [ ] caveman
    * [ ] codegraph
    * [ ] serena
* [X] Config in repo root — disable serena, set local doc dir, load project-specific docs deterministically
* [ ] SessionStart script — check required tools available (uvx, npm, etc.)
* [X] Inject into templates dynamic instructions for instance `! inject-language-specific-rules.py`
  * [X] skills/cr/reviewer-prompt-template.md (paths to docs)
  * [X] skills/create-adr/SKILL.md (adr docs path from config)
  * [X] skills/create-plan/references/plan-template.md (test & lint commands {test_command} {lint_command})
  * [X] agents/static-analyse.md
  * [X] agents/test-runner.md
