# BDK — Broneq Dev Kit

Claude Code plugin packaging reusable dev workflows (skills, agents, hooks) that install into any project.

## Architecture

```
skills/                  — thin workflow definitions (language-agnostic)
agents/                  — subagent definitions used internally by skills
hooks/                   — hooks.json + shell scripts
rules/                   — convention docs distributed WITH the plugin to end-users
STARTUP_INSTRUCTIONS.md  — injected into user sessions at SessionStart via hook
tests/skills/            — skill evals
docs/                    — design specs and analysis
```

> `rules/` = BDK distributable output — ships to user projects. Not `.claude/rules/` (dev-time conventions for BDK itself).

## Key Conventions

- Skills must be **language-agnostic** — no hardcoded `pytest`, `go test`, `npm test`, etc.
- Environment discovery (test runner, build tool, lint command) delegated to `STARTUP_INSTRUCTIONS.md`
- New skills auto-inherit all conventions — edit shared foundation, not individual skills
- Skills reference each other with full namespace: `/bdk:create-plan`, `/bdk:debug`
- Every skill starts with: `> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md)...`

## Development Commands

```bash
# Install BDK locally into a test project
# Launch Claude Code from the target project directory with:
claude --plugin-dir ~/projects/bdk

# Invoke a skill in the test project
/bdk:commit
/bdk:debug

# Run skill evals
# See rules/skill-test-eval.md for the eval format
```

## Adding a New Skill

1. Create `skills/<name>/skill.md`
2. Verify: no project-specific paths, tool names, or commands
3. Add entry to `## Skills` table in `README.md`
4. Write eval in `tests/skills/<name>/`

Portability rule: skill only makes sense for one language stack or domain → not BDK. Put in target project's `.claude/` instead.

## Adding an Agent

1. Create `agents/<name>.md`
2. Assign model (`haiku` = fast/cheap, `sonnet` = balanced, `opus` = deep analysis)
3. List in `## Agents` table in `README.md`

## Modifying the Shared Foundation

`STARTUP_INSTRUCTIONS.md` injected into every user session. Changes affect all skills.
- Keep concise — occupies context every session start
- Verify skills relying on modified section still work
- Test in isolated project after changes