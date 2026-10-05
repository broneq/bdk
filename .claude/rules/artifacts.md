---
paths:
  - "skills/**/*.md"
  - "agents/**/*.md"
---

# Skill Artifacts - State Under `.bdk/`

The kernel owns `.bdk/`: Change state (`.bdk/changes/`), project rules (`.bdk/rules/`) and settings. A skill writes there only through `bdk` commands, and never creates a directory of its own under `.bdk/`.

## Why

- One writer keeps the Change ledger, its index and its markers consistent; a hand-written file there is state the kernel cannot check or rebuild.
- `.bdk/<skill-name>/` directories are the v2 layout. `bdk doctor` reports them as `layout: v2`, and `/bdk:setup` migrates them.

## Exceptions

- Skills writing code or config into the project as code generation (a scaffold creating `src/components/Foo.tsx`) are exempt: the output is the product, not state.
- `/bdk:rules` sets `removed:` in a project rule file under `.bdk/rules/` by hand after the user approves the removal (`skills/tools/rules/SKILL.md`); no `bdk` command removes a rule.
