# Ideas to improve workflow

- [ ] Add rules for multi language support (TS, React, Python)
- [ ] Add startup script — check if required skills from other marketplaces installed:
  - [ ] caveman
- [x] Config in repo root - set local doc dir, load project-specific docs deterministically
- [ ] SessionStart script — check required tools available (npm, etc.)
- [x] Inject into templates dynamic instructions for instance `! inject-language-specific-rules.py`
  - [x] skills/cr/reviewer-prompt-template.md (paths to docs)
  - [x] skills/create-adr/SKILL.md (adr docs path from config)
  - [x] skills/create-plan/references/plan-template.md (test & lint commands {test_command} {lint_command})
  - [x] agents/static-analyse.md
  - [x] agents/test-runner.md
