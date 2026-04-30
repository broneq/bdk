---
paths:
  - "skills/**/*"
---

# Skill Directory Structure

Each skill lives at `skills/<skill-name>/` with this layout:

```
skills/<skill-name>/
├── SKILL.md            ← main instructions (required)
├── references/
│   └── *.md            ← templates and reference docs
├── examples/
│   └── *.md            ← example output showing expected format
├── scripts/
│   └── *               ← scripts Claude can execute
└── fragments/
    └── *.md            ← conditional injection targets
```

## Rules

- `SKILL.md` only file allowed at root level
- Templates and reference docs → `references/` (not root)
- Example outputs → `examples/` (`*.md` only)
- Executable scripts → `scripts/`
- Conditional injection targets → `fragments/` (see inject-fragments.md)
- No other subdirectories allowed

## Enforcement

`/bdk:skill-lint` check 20 flags invalid structure.