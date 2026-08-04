---
paths:
  - "skills/**/*.md"
  - "agents/**/*.md"
---

# Skill Artifacts — Output Directory Convention

Skills producing file output (reports, designs, generated docs, analysis) write to `.bdk/` in project root.

## Rule

```
Skill artifacts    → .bdk/<skill-name>/<output-file>
Cross-skill buffer → .bdk/<purpose>/<file>
```

Examples:
- `.bdk/design/2026-04-12-1430-auth-redesign-design.md`
- `.bdk/debug/session-2026-04-12-0900.md`
- `.bdk/plans/2026-04-12-1430-add-oauth.md`
- `.bdk/herdr/<agent-name>.md` - pane-agent return envelopes

Name the directory after the owning skill when one skill owns the output. Name it after the purpose when several skills read and write the same files (a transport buffer, a shared index). Never key a cross-skill buffer on whichever skill happened to create it first.

## Why

- Single discoverable location for all skill output
- Never pollutes `docs/`, `src/`, or project dirs
- Easy `.gitignore` or bulk inspect
- Portable — works any project structure

## Exceptions

Skills writing code/config into project as code generation (e.g. scaffold creating `src/components/Foo.tsx`) exempt — output IS product, not artifact.

## Enforcement

`/bdk:skill-lint` check 18 flags skills writing to non-`.bdk` paths.