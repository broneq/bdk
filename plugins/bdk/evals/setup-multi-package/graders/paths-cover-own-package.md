---
type: llm
---

The final reply reports the values written. PASS if it names the `paths` of the check items and every item that runs in `api/` (pytest, ruff) has globs that match only files under `api/`, and every item that runs in `web/` (vitest, eslint, the build) has globs that match only files under `web/`; a lint item may narrow further to one file type (`api/**/*.py`).
FAIL if the reply names no `paths`, an item has no `paths`, a glob reaches outside its package (`**`, `**/*.py` without the `api/` prefix), or an `api` item lists a `web/` glob or the reverse.
