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
- **Cross-skill assets are referenced, never copied.** A reference doc or script used by more than one skill lives in exactly one owning skill's directory; sibling skills reach it via `${CLAUDE_PLUGIN_ROOT}/skills/<owner>/references/...` (or `scripts/...`). Duplicating the file creates drifting copies (e.g. `add-rule` reads `refine-rules`' `rule-admission.md` and `lint_rules.py` this way).
- **Share a whole standard by skill name, one document by path.** When what several skills need is the *entire* guidance of an owning skill, point at `/bdk:<owner>` - its SKILL.md usually holds the decision rules while `references/` holds only the worked detail, so a path reference silently delivers the examples without the rules that govern them. Reserve `${CLAUDE_PLUGIN_ROOT}/skills/<owner>/references/<file>.md` for borrowing one self-contained document. Nothing errors either way; the wrong choice just loads half a standard.

## Enforcement

`/bdk:skill-lint` check 20 flags invalid structure.