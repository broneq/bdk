# Ideas to improve workflow

* [ ] Add rules for multi language support (TS, React, Python)
* [ ] Add startup script — check if required skills from other marketplaces installed:
    * [ ] caveman
    * [ ] codegraph
    * [ ] serena
* [ ] Config in repo root — disable serena, set local doc dir, load project-specific docs deterministically
* [ ] SessionStart script — check required tools available (uvx, npm, etc.)
* [ ] Inject into templates dynamic instructions for instance `! inject-language-specific-rules.py`
  * [ ] skills/cr/reviewer-prompt-template.md (paths to docs)
  * [ ] skills/create-adr/SKILL.md (adr docs path from config)

# References
## Startup script
No official API or CLI. Filesystem check is deterministic:

  Skills at known paths:
  #### personal
  ~/.claude/skills/<name>/SKILL.md

  ####  project
  .claude/skills/<name>/SKILL.md

  ####  plugin (installed)
  ~/.claude/plugins/cache/<plugin>/*/skills/<name>/SKILL.md

  Shell check:
  check_skill() {
    local name=$1
    [ -f ~/.claude/skills/$name/SKILL.md ] || \
    [ -f .claude/skills/$name/SKILL.md ] || \
    ls ~/.claude/plugins/cache/*/*/skills/$name/SKILL.md 2>/dev/null | grep -q .
  }

  BDK hook (SessionStart):
  if ! [ -f ~/.claude/skills/caveman/SKILL.md ]; then
    echo "WARNING: caveman skill not found"
  fi

Plugin skills use `<plugin>:<skill>` namespace. `bdk:commit` lives in plugin cache, not `~/.claude/skills/commit/`. Plugin installs → `~/.claude/plugins/cache/<plugin-name>/<version>/skills/`.

No `is-skill-installed` CLI. File existence check only deterministic approach today.

Sources:
- Extend Claude with skills — Claude Code Docs https://code.claude.com/docs/en/skills
- anthropics/claude-code#9444 — Plugin Dependencies feature request https://github.com/anthropics/claude-code/issues/9444
- anthropics/claude-code#27113 — Declarative skill/plugin dependencies https://github.com/anthropics/claude-code/issues/27113
