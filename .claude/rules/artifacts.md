---
paths:
  - "skills/**/*.md"
  - "agents/**/*.md"
---

# Skill Artifacts — Output Directory Convention

Skills producing file output (reports, designs, generated docs, analysis) write to `.bdk/` in project root.

## Rule

```
Skill artifacts → .bdk/<skill-name>/<output-file>
```

Examples:
- `.bdk/design/2026-04-12-1430-auth-redesign-design.md`
- `.bdk/debug/session-2026-04-12-0900.md`
- `.bdk/plans/2026-04-12-1430-add-oauth.md`

## Why

- Single discoverable location for all skill output
- Never pollutes `docs/`, `src/`, or project dirs
- Nothing to gitignore per skill, and easy to bulk inspect
- Portable — works any project structure

Nothing under `.bdk/` is tracked, `settings.json` included. `scripts/bdk_run_state.py` appends `/.bdk/` to `.gitignore` on the first plan run (`IGNORE_RULE`, with `EQUIVALENT_RULES` accepting the hand-written variants); `tests/unit/scripts/` covers it. A new artifact directory needs no gitignore work of its own.

## Exceptions

Skills writing code/config into project as code generation (e.g. scaffold creating `src/components/Foo.tsx`) exempt — output IS product, not artifact.

**Cross-skill run state** lives at `.bdk/runs/`, not under any one skill's name, because no single skill owns it: `subagent-execute-plan` advances it and `cr` reads it. Only `scripts/bdk_run_state.py` reads or writes there — skills call that script, never the files. Machine state, not an artifact: gitignored, and no human is meant to open it (use the script's `print` subcommand).

A skill must not write into another skill's `.bdk/<skill-name>/` directory. If two skills need to share something, it is run state and belongs behind the script above.

## Enforcement

`/bdk:skill-lint` check 18 flags skills writing to non-`.bdk` paths.