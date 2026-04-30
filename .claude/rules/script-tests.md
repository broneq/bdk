---
paths:
  - "tests/unit/**"
  - "skills/*/scripts/**"
  - "hooks/**/*.py"
---

# Script Tests

**Global rules only.** No skill-specific rules here. Every rule applies to all scripts.

Unit + integration tests for Python scripts in `skills/`, `hooks/`, etc.

## Directory Structure

Unit tests live under `tests/unit/`, mirroring source structure.
Evals (LLM output grading) live under `tests/evals/` — see `rules/skill-test-eval.md`.

```
tests/
├── unit/                        ← pytest, deterministic, fast
│   ├── hooks/
│   │   └── <hook-name>/
│   │       └── test_<script>.py
│   └── skills/
│       └── <skill-name>/
│           └── test_<script>.py
└── evals/                       ← skill behavior evals, NOT pytest
    └── skills/
        └── <skill-name>/
```

Source stays clean — no test files inside `skills/` or `hooks/`.

## Rules

- All unit tests in `tests/unit/` — mirrors source tree (`skills/foo/scripts/bar.py` → `tests/unit/skills/foo/test_bar.py`)
- File naming: `test_<module>.py` — pytest discovers by default
- Framework: `pytest` — plain functions, no `unittest.TestCase`
- Run all: `pytest tests/unit/`
- Run one: `pytest tests/unit/skills/<skill>/test_<module>.py`

## Assertions

Plain `assert` or pytest idioms:

```python
assert result == expected
assert "token" in output, f"missing token: {output!r}"

with pytest.raises(ValueError):
    bad_call()
```

## What to Test

**Unit** (`test_<module>.py`):
- Each public function in isolation
- Error/edge cases: invalid input, missing keys, empty files
- Output contracts: correct types, field names, return values

**Integration** (same file or `test_integration.py`):
- Full pipeline round-trip
- Subprocess invocation when script has top-level side effects
- Use `tmp_path` fixture or `tempfile.NamedTemporaryFile(delete=False)` + `finally: os.unlink(path)`

## Handling Scripts with Side Effects

Scripts that read stdin or call `sys.exit` at import time — stub before loading:

```python
import importlib, io, json
from unittest.mock import patch

def _load_module():
    fake_stdin = io.StringIO(json.dumps({"key": ""}))
    spec = importlib.util.spec_from_file_location("mod", PATH_TO_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    with patch("sys.stdin", fake_stdin), patch("sys.exit", side_effect=SystemExit):
        try:
            spec.loader.exec_module(mod)
        except SystemExit:
            pass
    return mod
```
