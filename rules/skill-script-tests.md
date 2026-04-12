---
paths:
  - ".claude/skills/*/scripts/**"
  - ".claude/skills/*/tests/**"
---

# Skill Script Tests

**This file contains global rules only.** Do not add skill-specific rules here — those belong in the skill's own `SKILL.md`. Every rule here must apply equally to all skills.

Unit and integration tests for Python scripts bundled inside skills (e.g., `my_builder/`).

## Directory Structure

```
.claude/skills/<skill-name>/
├── scripts/
│   └── my_module/
│       ├── base.py
│       ├── format_a.py
│       └── format_b.py
└── tests/
    ├── test_format_a.py     ← unit: one file per script module
    ├── test_format_b.py
    └── test_integration.py  ← integration: full round-trip through save() + validator
```

## Rules

- One unit test file per script module
- Integration tests in `test_integration.py` — cover full round-trips against real templates
- All test files live in `.claude/skills/<skill-name>/tests/`
- Each file runs standalone: `python3 test_sea_builder.py`
- Use plain `assert` with descriptive messages — no pytest, no unittest

## Assertions

```python
assert result == expected, f"delete() should wrap text: got {result!r}"
assert "ice-del" in result, f"SEA deletion missing ice-del class: {result!r}"
```

## Running Tests

Single file:
```bash
python3 .claude/skills/<skill-name>/tests/test_<module>.py
```

All tests in a skill:
```bash
for f in .claude/skills/<skill-name>/tests/test_*.py; do python3 "$f"; done
```

## What to Test

**Unit tests** (`test_<module>.py`):
- Each public method in isolation
- Error cases (invalid input, item not found, out-of-range index)
- Output structure contracts: correct field names, types, and absence of raw markup in text-output fields

**Integration tests** (`test_integration.py`):
- Full round-trip through the skill's primary workflow (build → save → validate)
- One test per operation type per format variant
- Use `tempfile.NamedTemporaryFile` with `delete=False` + manual `unlink()` in `finally` for temp files
