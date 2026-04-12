---
paths:
  - "skills/**/*.md"
  - "agents/**/*.md"
---

# Skill Artifacts — Output Directory Convention

Skills producing file output (reports, designs, generated docs, analysis) write to `.bdx/` in project root.

## Rule

```
Skill artifacts → .bdx/<skill-name>/<output-file>
```

Examples:
- `.bdx/brainstorming/2026-04-12-auth-redesign-design.md`
- `.bdx/debug/session-2026-04-12.md`
- `.bdx/create-plan/implementation-plan.md`

## Why

- Single discoverable location for all skill output
- Never pollutes `docs/`, `src/`, or project dirs
- Easy `.gitignore` or bulk inspect
- Portable — works any project structure

## Exceptions

Skills writing code/config into project as code generation (e.g. scaffold creating `src/components/Foo.tsx`) exempt — output IS product, not artifact.

## Enforcement

`/bdk:skill-lint` check 18 flags skills writing to non-`.bdx` paths.